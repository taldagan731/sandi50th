import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAccess } from "@/lib/studio/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const coordinate = z.number().min(0).max(1);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"), mediaId: z.string().uuid(), personName: z.string().trim().min(1).max(80),
    x: coordinate, y: coordinate, width: z.number().positive().max(1), height: z.number().positive().max(1)
  }),
  z.object({ action: z.literal("confirm"), tagId: z.string().uuid(), personName: z.string().trim().min(1).max(80) }),
  z.object({ action: z.literal("reject"), tagId: z.string().uuid() }),
  z.object({ action: z.literal("remove"), tagId: z.string().uuid() })
]);

async function ownerMedia(owner: NonNullable<Awaited<ReturnType<typeof requireStudioAccess>>>, mediaId: string) {
  const { data: media } = await owner.supabase.from("media_assets").select("id,submission_id,mime_type").eq("id", mediaId).maybeSingle();
  if (!media || !String(media.mime_type).startsWith("image/")) return null;
  const { data: submission } = await owner.supabase.from("submissions").select("project_id").eq("id", media.submission_id).eq("project_id", owner.project.id).maybeSingle();
  return submission ? media : null;
}

function publicTag(tag: Record<string, unknown>) {
  return {
    id: String(tag.id), name: String(tag.person_name || ""), x: Number(tag.x), y: Number(tag.y),
    width: Number(tag.width), height: Number(tag.height), status: String(tag.status), source: String(tag.source),
    confidence: tag.confidence == null ? null : Number(tag.confidence)
  };
}

export async function GET(request: Request) {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mediaId = new URL(request.url).searchParams.get("mediaId");
  if (!mediaId || !await ownerMedia(owner, mediaId)) return NextResponse.json({ error: "Photograph not found." }, { status: 404 });
  const { data, error } = await owner.supabase.from("photo_face_tags")
    .select("id,person_name,x,y,width,height,status,source,confidence")
    .eq("project_id", owner.project.id).eq("media_asset_id", mediaId).neq("status", "rejected").order("created_at");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || /photo_face_tags|schema cache/i.test(error.message)) return NextResponse.json({ tags: [], people: [], migrationRequired: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { data: names } = await owner.supabase.from("photo_face_tags").select("person_name")
    .eq("project_id", owner.project.id).eq("status", "confirmed").neq("person_name", "").limit(1000);
  const people = [...new Set((names ?? []).map(item => item.person_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return NextResponse.json({ tags: (data ?? []).map(tag => publicTag(tag)), people, migrationRequired: false });
}

export async function POST(request: Request) {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the face tag." }, { status: 400 });
  const body = parsed.data;
  if (body.action === "add") {
    if (!await ownerMedia(owner, body.mediaId)) return NextResponse.json({ error: "Photograph not found." }, { status: 404 });
    const width = Math.min(body.width, 1 - body.x);
    const height = Math.min(body.height, 1 - body.y);
    const { data, error } = await owner.supabase.from("photo_face_tags").insert({
      project_id: owner.project.id, media_asset_id: body.mediaId, person_name: body.personName,
      x: body.x, y: body.y, width, height, status: "confirmed", source: "manual", confidence: 1
    }).select("id,person_name,x,y,width,height,status,source,confidence").single();
    if (error) return NextResponse.json({ error: (error.code === "42P01" || error.code === "PGRST205") ? "Install supabase/photo-face-tags-migration.sql first." : error.message }, { status: (error.code === "42P01" || error.code === "PGRST205") ? 503 : 500 });
    return NextResponse.json({ tag: publicTag(data) }, { status: 201 });
  }
  const { data: existing } = await owner.supabase.from("photo_face_tags").select("id,project_id").eq("id", body.tagId).eq("project_id", owner.project.id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Face tag not found." }, { status: 404 });
  if (body.action === "remove") {
    const { error } = await owner.supabase.from("photo_face_tags").delete().eq("id", body.tagId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const update = body.action === "confirm"
    ? { status: "confirmed", person_name: body.personName, confidence: 1, updated_at: new Date().toISOString() }
    : { status: "rejected", updated_at: new Date().toISOString() };
  const { error } = await owner.supabase.from("photo_face_tags").update(update).eq("id", body.tagId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
