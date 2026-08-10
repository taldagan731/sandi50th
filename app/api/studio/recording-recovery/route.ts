import { list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAccess } from "@/lib/studio/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({ keyword: z.literal("Purple50") });

export async function POST(request: Request) {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confirmation phrase required." }, { status: 400 });

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
