import { copy, head, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAccess } from "@/lib/studio/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  submissionId: z.string().uuid().optional()
}).optional();

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, "-").slice(0, 180) || "memory";
}

export async function POST(request: Request) {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let requestedSubmissionId: string | undefined;
  try {
    const text = await request.text();
    requestedSubmissionId = text ? requestSchema.parse(JSON.parse(text))?.submissionId : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid backup verification request." }, { status: 400 });
  }

  let submissionQuery = owner.supabase
    .from("submissions")
    .select("*")
    .eq("project_id", owner.project.id)
    .order("created_at");
  if (requestedSubmissionId) submissionQuery = submissionQuery.eq("id", requestedSubmissionId);
  const { data: submissions, error: submissionError } = await submissionQuery;
  if (submissionError) return NextResponse.json({ error: submissionError.message }, { status: 500 });

  const submissionIds = (submissions ?? []).map(item => item.id);
  const { data: media, error: mediaError } = submissionIds.length
    ? await owner.supabase.from("media_assets").select("*").in("submission_id", submissionIds).order("created_at")
    : { data: [], error: null };
  if (mediaError) return NextResponse.json({ error: mediaError.message }, { status: 500 });

  const results: Array<{ submissionId: string; fileCount: number; manifestPath: string }> = [];
  const failures: Array<{ submissionId: string; name: string; reason: string }> = [];

  for (const submission of submissions ?? []) {
    try {
      const items = (media ?? []).filter(item => item.submission_id === submission.id);
      const files = [];

      for (const [index, item] of items.entries()) {
        const expectedBytes = Number(item.bytes);
        const primaryPath = String(item.storage_path);
        const backupPath = `backups/${submission.id}/media/${String(index + 1).padStart(3, "0")}-${safeName(item.original_name)}`;
        let backup;
        let primaryEtag: string | null = null;

        if (primaryPath.startsWith("incoming/")) {
          const source = await head(primaryPath);
          if (source.size !== expectedBytes) {
            throw new Error(`Primary size mismatch for ${item.original_name}: expected ${expectedBytes}, found ${source.size}.`);
          }
          primaryEtag = source.etag;
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
          const contentLength = Number(response.headers.get("content-length") || 0);
          if (contentLength && contentLength !== expectedBytes) {
            throw new Error(`Legacy primary size mismatch for ${item.original_name}: expected ${expectedBytes}, found ${contentLength}.`);
          }
          backup = await put(backupPath, response.body, {
            access: "private",
            contentType: item.mime_type,
            allowOverwrite: true,
            multipart: expectedBytes >= 50 * 1024 * 1024
          });
        }

        const verified = await head(backup.pathname);
        if (verified.size !== expectedBytes) {
          throw new Error(`Backup size mismatch for ${item.original_name}: expected ${expectedBytes}, found ${verified.size}.`);
        }

        files.push({
          mediaId: item.id,
          originalName: item.original_name,
          contentType: item.mime_type,
          bytes: expectedBytes,
          primaryPath,
          primaryEtag,
          backupPath: backup.pathname,
          backupEtag: verified.etag,
          byteCountVerified: true
        });
      }

      const manifestPath = `backups/${submission.id}/manifest.json`;
      const verifiedAt = new Date().toISOString();
      const manifest = await put(manifestPath, JSON.stringify({
        version: 3,
        verifiedAt,
        verification: "primary and backup object existence plus exact byte count",
        submission,
        files
      }, null, 2), {
        access: "private",
        contentType: "application/json",
        allowOverwrite: true
      });
      const manifestHead = await head(manifest.pathname);
      if (manifestHead.size === 0) throw new Error("The backup manifest was empty after writing.");

      results.push({ submissionId: submission.id, fileCount: files.length, manifestPath });
    } catch (error) {
      failures.push({
        submissionId: submission.id,
        name: submission.name,
        reason: error instanceof Error ? error.message : "Unknown backup error"
      });
    }
  }

  return NextResponse.json({
    ok: failures.length === 0,
    verification: "Every primary and backup object was checked for existence and exact byte count.",
    submissionCount: results.length,
    fileCount: results.reduce((total, item) => total + item.fileCount, 0),
    failureCount: failures.length,
    failures,
    results
  });
}
