import { copy, head, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultReviewStatus } from "@/lib/chapters";

export const runtime = "nodejs";

const fileSchema = z.object({
  pathname: z.string().min(1).max(900),
  url: z.string().url(),
  downloadUrl: z.string().url(),
  contentType: z.string().min(1).max(150),
  contentDisposition: z.string().max(500),
  originalName: z.string().regex(/^name-chorus-[0-9a-f-]+\.(wav|m4a|mp3|ogg|webm)$/i),
  bytes: z.number().int().positive().max(10 * 1024 * 1024)
});
const schema = z.object({ submissionId: z.string().uuid(), file: fileSchema });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const expectedPath = `incoming/${body.submissionId}/${body.file.originalName}`;
    if (body.file.pathname !== expectedPath) return NextResponse.json({ error: "This recording did not match its contribution." }, { status: 400 });
    const primary = await head(body.file.pathname);
    if (primary.size !== body.file.bytes) throw new Error("The recording did not finish uploading.");

    const supabase = createAdminClient();
    const { data: submission, error } = await supabase.from("submissions").select("name").eq("id", body.submissionId).single();
    if (error || !submission) return NextResponse.json({ error: "The contribution could not be found." }, { status: 404 });
    const reviewStatus = defaultReviewStatus(submission.name);
    const { error: mediaError } = await supabase.from("media_assets").upsert({
      submission_id: body.submissionId,
      storage_path: body.file.pathname,
      original_name: body.file.originalName,
      mime_type: body.file.contentType,
      bytes: body.file.bytes,
      review_status: reviewStatus,
      chapter_number: null
    }, { onConflict: "storage_path" });
    if (mediaError) throw mediaError;

    const backup = await copy(body.file.pathname, `backups/${body.submissionId}/name-chorus/${body.file.originalName}`, {
      access: "private",
      contentType: body.file.contentType,
      allowOverwrite: true,
      ifMatch: primary.etag
    });
    const verified = await head(backup.pathname);
    if (verified.size !== body.file.bytes) throw new Error("The backup could not be verified.");
    await put(`backups/${body.submissionId}/name-chorus/${body.file.originalName}.json`, JSON.stringify({
      version: 1,
      createdAt: new Date().toISOString(),
      primaryPath: body.file.pathname,
      backupPath: backup.pathname,
      bytes: body.file.bytes,
      primaryEtag: primary.etag,
      backupEtag: verified.etag
    }), { access: "private", contentType: "application/json", allowOverwrite: true });

    await supabase.from("submissions").update({
      status: reviewStatus === "excluded" ? "excluded" : "uploaded",
      review_status: reviewStatus,
      upload_completed_at: new Date().toISOString()
    }).eq("id", body.submissionId).eq("prompt", "NAME_CHORUS");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("name-chorus-complete", error);
    return NextResponse.json({ error: "Your contribution is safe, but the name recording could not be confirmed. Please try just the name again." }, { status: 500 });
  }
}
