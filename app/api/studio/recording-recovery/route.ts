import { list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAccess } from "@/lib/studio/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({ keyword: z.literal("Purple50"), action: z.enum(["audit", "finalizeOwnerArchive"]).default("audit"), submissionId: z.string().uuid().optional() });

export async function POST(request: Request) {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confirmation phrase required." }, { status: 400 });

  if (parsed.data.action === "finalizeOwnerArchive") {
    if (!parsed.data.submissionId) return NextResponse.json({ error: "Submission ID required." }, { status: 400 });
    const { data: archive } = await owner.supabase.from("submissions")
      .select("id,prompt,upload_completed_at")
      .eq("id", parsed.data.submissionId).eq("project_id", owner.project.id).maybeSingle();
    if (!archive || archive.prompt !== "OWNER_ARCHIVE") return NextResponse.json({ error: "Owner archive not found." }, { status: 404 });
    const { data: media } = await owner.supabase.from("media_assets").select("storage_path,bytes").eq("submission_id", archive.id);
    if (!media?.length) return NextResponse.json({ error: "Owner archive has no stored media." }, { status: 409 });
    const blobs = await list({ prefix: `incoming/${archive.id}/`, limit: 100 });
    const sizes = new Map(blobs.blobs.map(blob => [blob.pathname, blob.size]));
    const complete = media.every(item => sizes.get(item.storage_path) === Number(item.bytes));
    if (!complete) return NextResponse.json({ error: "Owner archive files are not all present at their recorded byte counts." }, { status: 409 });
    const completedAt = archive.upload_completed_at || new Date().toISOString();
    const { error: updateError } = await owner.supabase.from("submissions").update({ upload_completed_at: completedAt }).eq("id", archive.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ ok: true, submissionId: archive.id, fileCount: media.length, completedAt });
  }
  const { data: submissions, error } = await owner.supabase.from("submissions")
    .select("id,name,contact,prompt,status,created_at,upload_completed_at")
    .eq("project_id", owner.project.id)
    .is("upload_completed_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const submission of submissions ?? []) {
    const { data: media } = await owner.supabase.from("media_assets")
      .select("id,storage_path,original_name,mime_type,bytes,created_at")
      .eq("submission_id", submission.id);
    const blobs = await list({ prefix: `incoming/${submission.id}/`, limit: 100 });
    const uploaded = blobs.blobs.filter(blob => !blob.pathname.includes("/web/"));
    results.push({
      submission,
      media: media ?? [],
      blobs: uploaded.map(blob => ({ pathname: blob.pathname, bytes: blob.size, uploadedAt: blob.uploadedAt })),
      recoverable: uploaded.length > 0
    });
  }
  return NextResponse.json({ incomplete: results.length, recoverable: results.filter(item => item.recoverable).length, results }, { headers: { "Cache-Control": "private, no-store" } });
}
