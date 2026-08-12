import { copy, head, put } from "@vercel/blob";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueSubmissionPhotos, processPhotoAnalysisJobs } from "@/lib/photo-intelligence";
import { sendContributionArrivalEmail } from "@/lib/notifications/contribution-email";

export type FinalizeUploadFile = {
  pathname: string;
  url: string;
  downloadUrl: string;
  contentType: string;
  contentDisposition: string;
  originalName: string;
  bytes: number;
};

type FinalizeSubmissionArgs = {
  submissionId: string;
  files: FinalizeUploadFile[];
  sendArrivalAlert?: boolean;
};

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

export async function finalizeSubmissionUpload({ submissionId, files, sendArrivalAlert = true }: FinalizeSubmissionArgs) {
  const expectedPrefix = `incoming/${submissionId}/`;
  const backupPrefix = `backups/${submissionId}`;
  const supabase = createAdminClient();

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", submissionId)
    .single();
  if (submissionError || !submission) {
    throw new Error("Submission not found.");
  }

  for (const file of files) {
    if (!file.pathname.startsWith(expectedPrefix)) {
      throw new Error("An uploaded file did not belong to this contribution.");
    }
  }

  const verifiedPrimary = await mapLimit(files, 5, async file => {
    const stored = await head(file.pathname);
    if (stored.size !== file.bytes) {
      throw new Error(`${file.originalName} did not finish uploading. Please try that file again.`);
    }

    const { error: mediaError } = await supabase.from("media_assets").upsert({
      submission_id: submissionId,
      storage_path: file.pathname,
      original_name: file.originalName,
      mime_type: file.contentType,
      bytes: file.bytes,
      review_status: submission.prompt === "CHAPTER_NINE" ? "included" : undefined,
      chapter_number: submission.prompt === "CHAPTER_NINE" ? 9 : undefined
    }, { onConflict: "storage_path" });
    if (mediaError) throw mediaError;
    return { file, etag: stored.etag };
  });

  const completedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("submissions")
    .update({
      status: submission.prompt === "CHAPTER_NINE" ? "chapter-nine" : "uploaded",
      upload_completed_at: completedAt,
      review_status: submission.prompt === "CHAPTER_NINE" ? "included" : submission.review_status
    })
    .eq("id", submissionId);
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
      submission: { ...submission, upload_completed_at: completedAt },
      files: manifestFiles
    }, null, 2), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true
    });
    backupVerified = true;
  } catch (error) {
    backupError = error instanceof Error ? error.message : "Unknown backup error";
    console.error("submission-backup", { submissionId, error: backupError });
  }

  try {
    if (submission.prompt !== "CHAPTER_NINE") {
      const queued = await enqueueSubmissionPhotos(submissionId);
      if (queued.available && queued.queued > 0) {
        void processPhotoAnalysisJobs({ limit: 2, submissionId }).catch(error => {
          console.error("photo-analysis-worker-unavailable", error);
        });
      } else if (!queued.available) {
        console.error("photo-analysis-queue-unavailable", queued);
      }
    }
  } catch (error) {
    console.error("photo-analysis-enqueue", { submissionId, error });
  }

  if (sendArrivalAlert && submission.prompt !== "CHAPTER_NINE") {
    try {
      await sendContributionArrivalEmail({
        name: submission.name,
        relationship: submission.relationship,
        prompt: submission.prompt,
        fileCount: files.length,
        submissionId
      });
    } catch (error) {
      console.error("contribution-arrival-email", { submissionId, error });
    }
  }

  return {
    ok: true,
    submissionId,
    fileCount: files.length,
    backupVerified,
    backupError
  };
}
