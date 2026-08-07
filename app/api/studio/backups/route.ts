import { copy, head, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, "-").slice(0, 180) || "memory";
}

export async function POST() {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: submissions, error: submissionError } = await owner.supabase
    .from("submissions")
    .select("*")
    .eq("project_id", owner.project.id)
    .order("created_at");
  if (submissionError) return NextResponse.json({ error: submissionError.message }, { status: 500 });

  const submissionIds = (submissions ?? []).map(item => item.id);
  const { data: media, error: mediaError } = submissionIds.length
    ? await owner.supabase.from("media_assets").select("*").in("submission_id", submissionIds).order("created_at")
    : { data: [], error: null };
  if (mediaError) return NextResponse.json({ error: mediaError.message }, { status: 500 });

  const results: Array<{ submissionId: string; fileCount: number; manifestPath: string }> = [];

  for (const submission of submissions ?? []) {
    const items = (media ?? []).filter(item => item.submission_id === submission.id);
    const files = [];

    for (const [index, item] of items.entries()) {
      const primaryPath = String(item.storage_path);
      const backupPath = `backups/${submission.id}/media/${String(index + 1).padStart(2, "0")}-${safeName(item.original_name)}`;
      let backup;

      if (primaryPath.startsWith("incoming/")) {
        const source = await head(primaryPath);
        backup = await copy(primaryPath, backupPath, {
          access: "private",
          contentType: item.mime_type,
          allowOverwrite: true,
          ifMatch: source.etag
        });
      } else {
        const { data: signed, error: signedError } = await owner.supabase.storage
          .from("sandi-memories")
          .createSignedUrl(primaryPath, 300);
        if (signedError || !signed) throw new Error(`Could not retrieve legacy file ${item.original_name}.`);
        const response = await fetch(signed.signedUrl);
        if (!response.ok || !response.body) throw new Error(`Could not read legacy file ${item.original_name}.`);
        backup = await put(backupPath, response.body, {
          access: "private",
          contentType: item.mime_type,
          allowOverwrite: true,
          multipart: Number(item.bytes) >= 50 * 1024 * 1024
        });
      }

      const verified = await head(backup.pathname);
      if (verified.size !== Number(item.bytes)) {
        throw new Error(`Backup verification failed for ${item.original_name}.`);
      }

      files.push({
        mediaId: item.id,
        originalName: item.original_name,
        contentType: item.mime_type,
        bytes: Number(item.bytes),
        primaryPath,
        backupPath: backup.pathname,
        backupEtag: verified.etag
      });
    }

    const manifestPath = `backups/${submission.id}/manifest.json`;
    await put(manifestPath, JSON.stringify({
      version: 1,
      createdAt: new Date().toISOString(),
      submission,
      files
    }, null, 2), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true
    });
    results.push({ submissionId: submission.id, fileCount: files.length, manifestPath });
  }

  return NextResponse.json({
    ok: true,
    submissionCount: results.length,
    fileCount: results.reduce((total, item) => total + item.fileCount, 0),
    results
  });
}
