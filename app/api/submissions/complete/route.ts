import { copy, head, put } from "@vercel/blob";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { chapterNumberFromContributor, defaultReviewStatus } from "@/lib/chapters";
import { enqueueSubmissionPhotos } from "@/lib/photo-intelligence";
import { enqueueSubmissionHashing, processHashJobs } from "@/lib/duplicate-detection";
import { sendContributionArrivalEmail } from "@/lib/notifications/contribution-email";
import { processSubmissionImageDerivatives } from "@/lib/media-derivatives";

export const runtime = "nodejs";
export const maxDuration = 300;

const fileSchema = z.object({
  pathname: z.string().min(1).max(900),
  url: z.string().url().max(1500),
  downloadUrl: z.string().url().max(1500),
  contentType: z.string().min(1).max(150),
  contentDisposition: z.string().max(500),
  originalName: z.string().min(1).max(500),
  bytes: z.number().int().positive()
});

const schema = z.object({
  submissionId: z.string().uuid(),
  files: z.array(fileSchema).max(1000)
});

function safeBackupName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 200) || "memory";
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const expectedPrefix = `incoming/${body.submissionId}/`;
    const backupPrefix = `backups/${body.submissionId}`;
    const supabase = createAdminClient();

    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", body.submissionId)
      .single();
    if (submissionError || !submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    const reviewStatus = defaultReviewStatus(submission.name);
    const chapterNumber = chapterNumberFromContributor(submission.life_chapter);

    for (const file of body.files) {
      if (!file.pathname.startsWith(expectedPrefix)) {
        return NextResponse.json({ error: "An uploaded file did not belong to this contribution." }, { status: 400 });
      }
    }

    const verifiedPrimary: Array<{ file: z.infer<typeof fileSchema>; etag: string }> = [];

    for (const file of body.files) {
      const stored = await head(file.pathname);
      if (stored.size !== file.bytes) {
        throw new Error(`${file.originalName} did not finish uploading. Please try that file again.`);
      }

      const { error: mediaError } = await supabase.from("media_assets").upsert({
        submission_id: body.submissionId,
        storage_path: file.pathname,
        original_name: file.originalName,
        mime_type: file.contentType,
        bytes: file.bytes,
        review_status: reviewStatus,
        chapter_number: chapterNumber
      }, { onConflict: "storage_path" });
      if (mediaError) throw mediaError;
      verifiedPrimary.push({ file, etag: stored.etag });
    }

    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        status: reviewStatus === "excluded" ? "excluded" : "uploaded",
        review_status: reviewStatus,
        upload_completed_at: completedAt
      })
      .eq("id", body.submissionId);
    if (updateError) throw updateError;

    let backupVerified = false;
    let backupError: string | null = null;

    try {
      const manifestFiles = await mapLimit(verifiedPrimary, 4, async (item, index) => {
        const backupPath = `${backupPrefix}/media/${String(index + 1).padStart(3, "0")}-${safeBackupName(item.file.originalName)}`;
        const backup = await copy(item.file.pathname, backupPath, {
          access: "private",
          contentType: item.file.contentType,
          allowOverwrite: true,
          ifMatch: item.etag
        });
        const verifiedBackup = await head(backup.pathname);
        if (verifiedBackup.size !== item.file.bytes) {
          throw new Error(`Backup verification failed for ${item.file.originalName}.`);
        }
        return {
          originalName: item.file.originalName,
          contentType: item.file.contentType,
          bytes: item.file.bytes,
          primaryPath: item.file.pathname,
          backupPath: backup.pathname,
          primaryEtag: item.etag,
          backupEtag: verifiedBackup.etag
        };
      });

      await put(`${backupPrefix}/manifest.json`, JSON.stringify({
        version: 2,
        createdAt: completedAt,
        submission,
        files: manifestFiles
      }, null, 2), {
        access: "private",
        contentType: "application/json",
        allowOverwrite: true
      });
      backupVerified = true;
    } catch (error) {
      backupError = error instanceof Error ? error.message : "Unknown backup error";
      console.error("submission-backup", { submissionId: body.submissionId, error: backupError });
    }

    try {
      const queued = await enqueueSubmissionPhotos(body.submissionId);
      if (!queued.available) console.error("photo-analysis-queue-unavailable", queued);
    } catch (error) {
      // Analysis is downstream of a successful contribution and must never block or roll back the upload.
      console.error("photo-analysis-enqueue", { submissionId: body.submissionId, error });
    }

    after(async () => {
      try {
        const derivatives = await processSubmissionImageDerivatives(supabase, body.submissionId);
        for (const result of derivatives) {
          if (result.status === "failed") {
            console.error("image-derivative-background", {
              submissionId: body.submissionId,
              mediaId: result.mediaId,
              originalName: result.originalName,
              error: result.error
            });
          }
        }
      } catch (error) {
        // Presentation-copy creation is downstream and must never block contribution confirmation.
        console.error("image-derivative-background", {
          submissionId: body.submissionId,
          error: error instanceof Error ? error.message : "Unknown derivative error"
        });
      }

      try {
        const queued = await enqueueSubmissionHashing(body.submissionId);
        if (queued.available && queued.queued) {
          await processHashJobs({ limit: Math.min(6, queued.queued), submissionId: body.submissionId });
        } else if (!queued.available) {
          console.error("duplicate-hash-queue-unavailable", queued);
        }
      } catch (error) {
        // Duplicate detection is downstream of successful storage and backup verification.
        console.error("duplicate-hash-background", {
          submissionId: body.submissionId,
          error: error instanceof Error ? error.message : "Unknown hashing error"
        });
      }

      try {
        const result = await sendContributionArrivalEmail({
          submissionId: body.submissionId,
          contributorName: submission.name || "A contributor",
          relationship: submission.relationship || null,
          prompt: submission.prompt || null,
          lifeChapter: submission.life_chapter || null,
          fileCount: verifiedPrimary.length,
          receivedAt: completedAt
        });
        if (result.sent) {
          console.info("contribution-email-sent", { submissionId: body.submissionId, emailId: result.id });
        } else if (process.env.RESEND_API_KEY) {
          console.error("contribution-email-not-sent", result.reason);
        }
      } catch (error) {
        // A notification can fail without affecting the contribution or its verified backup.
        console.error("contribution-email", {
          submissionId: body.submissionId,
          error: error instanceof Error ? error.message : "Unknown notification error"
        });
      }
    });

    return NextResponse.json({
      ok: true,
      submissionId: body.submissionId,
      fileCount: verifiedPrimary.length,
      backupVerified,
      backupError
    });
  } catch (error) {
    console.error("submission-complete", error);
    const message = error instanceof Error && /did not finish uploading/i.test(error.message)
      ? error.message
      : "Your files may have arrived, but confirmation failed. Do not delete them from your phone; email uploads@sandi50th.com and we will verify them.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
