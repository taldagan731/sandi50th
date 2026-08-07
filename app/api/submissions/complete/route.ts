import { copy, head, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const fileSchema = z.object({
  pathname: z.string().min(1).max(900),
  url: z.string().url().max(1500),
  downloadUrl: z.string().url().max(1500),
  contentType: z.string().min(1).max(150),
  contentDisposition: z.string().max(500),
  originalName: z.string().min(1).max(300),
  bytes: z.number().int().positive()
});

const schema = z.object({
  submissionId: z.string().uuid(),
  files: z.array(fileSchema).max(20)
});

function safeBackupName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 180) || "memory";
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

    const manifestFiles: Array<{
      originalName: string;
      contentType: string;
      bytes: number;
      primaryPath: string;
      backupPath: string;
      primaryEtag: string;
      backupEtag: string;
    }> = [];

    for (const [index, file] of body.files.entries()) {
      if (!file.pathname.startsWith(expectedPrefix)) {
        return NextResponse.json({ error: "An uploaded file did not belong to this contribution." }, { status: 400 });
      }

      const stored = await head(file.pathname, { access: "private" });
      if (stored.size !== file.bytes) {
        return NextResponse.json({
          error: `${file.originalName} did not finish uploading. Please try that file again.`
        }, { status: 409 });
      }

      const { error: mediaError } = await supabase.from("media_assets").upsert({
        submission_id: body.submissionId,
        storage_path: file.pathname,
        original_name: file.originalName,
        mime_type: file.contentType,
        bytes: file.bytes
      }, { onConflict: "storage_path" });
      if (mediaError) throw mediaError;

      const backupPath = `${backupPrefix}/media/${String(index + 1).padStart(2, "0")}-${safeBackupName(file.originalName)}`;
      const backup = await copy(file.pathname, backupPath, {
        access: "private",
        contentType: file.contentType,
        allowOverwrite: true,
        ifMatch: stored.etag
      });

      manifestFiles.push({
        originalName: file.originalName,
        contentType: file.contentType,
        bytes: file.bytes,
        primaryPath: file.pathname,
        backupPath: backup.pathname,
        primaryEtag: stored.etag,
        backupEtag: backup.etag
      });
    }

    const completedAt = new Date().toISOString();
    const manifest = {
      version: 1,
      createdAt: completedAt,
      submission,
      files: manifestFiles
    };

    await put(`${backupPrefix}/manifest.json`, JSON.stringify(manifest, null, 2), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true
    });

    const { error: updateError } = await supabase
      .from("submissions")
      .update({ status: "uploaded", upload_completed_at: completedAt })
      .eq("id", body.submissionId);
    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      submissionId: body.submissionId,
      fileCount: body.files.length,
      backupVerified: true
    });
  } catch (error) {
    console.error("submission-complete", error);
    return NextResponse.json({
      error: "Your files may have arrived, but confirmation or backup failed. Do not delete them from your phone; email uploads@sandi50th.com and we will verify them."
    }, { status: 500 });
  }
}
