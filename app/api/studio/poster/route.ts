import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireStudioAccess } from "@/lib/studio/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const mediaId = String(form.get("mediaId") ?? "");
  const image = form.get("poster");
  if (!/^[0-9a-f-]{36}$/i.test(mediaId) || !(image instanceof File) || image.type !== "image/jpeg") {
    return NextResponse.json({ error: "A JPEG poster frame is required." }, { status: 400 });
  }
  if (image.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Poster frame exceeds 2 MB." }, { status: 400 });
  }

  const { data: media } = await owner.supabase
    .from("media_assets")
    .select("id,submission_id,mime_type")
    .eq("id", mediaId)
    .single();
  if (!media || !media.mime_type.startsWith("video/")) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }
  const { data: submission } = await owner.supabase
    .from("submissions")
    .select("project_id")
    .eq("id", media.submission_id)
    .eq("project_id", owner.project.id)
    .single();
  if (!submission) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const pathname = `posters/${mediaId}.jpg`;
  await put(pathname, image, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "image/jpeg"
  });

  const { error } = await owner.supabase
    .from("media_assets")
    .update({ poster_path: pathname })
    .eq("id", mediaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, pathname });
}
