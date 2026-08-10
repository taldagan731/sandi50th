import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudioOwner } from "@/lib/studio/auth";
import { hasRevealPreviewAccess } from "@/lib/reveal-preview";
import { getRevealShareAccess } from "@/lib/reveal-share";
import { getRevealProject } from "@/lib/reveal-visibility";
import { isTestContributor } from "@/lib/chapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
const publicTagSchema = z.object({
  mediaId: idSchema,
  personName: z.string().trim().min(1).max(80),
  authorName: z.string().trim().max(80).optional().default(""),
  x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  width: z.number().positive().max(1), height: z.number().positive().max(1),
  website: z.string().max(0).optional().default("")
});
type RateEntry = { startedAt: number; count: number };
const rateWindow = new Map<string, RateEntry>();
function rateLimited(request: Request) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const entry = rateWindow.get(key);
  if (!entry || now - entry.startedAt > 10 * 60 * 1000) { rateWindow.set(key, { startedAt: now, count: 1 }); return false; }
  entry.count += 1;
  return entry.count > 8;
}

async function accessFor(mediaId: string) {
  const owner = await requireStudioOwner();
  const ownerPreview = owner ? false : await hasRevealPreviewAccess();
  const share = owner || ownerPreview ? null : await getRevealShareAccess();
  const publicProject = await getRevealProject();
  const project = owner?.project ?? publicProject;
  const mayView = Boolean(owner || ownerPreview || (share && project && share.projectId === project.id) || publicProject?.revealPublic);
  if (!project || !mayView) return null;
  const supabase = owner?.supabase ?? createAdminClient();
  const { data: media } = await supabase.from("media_assets").select("id,submission_id,review_status").eq("id", mediaId).maybeSingle();
  if (!media || (!owner && media.review_status === "excluded")) return null;
  const { data: submission } = await supabase.from("submissions").select("project_id,name,review_status").eq("id", media.submission_id).eq("project_id", project.id).maybeSingle();
  if (!submission || (!owner && (submission.review_status === "excluded" || isTestContributor(submission.name)))) return null;
  return { supabase, projectId: project.id };
}

export async function POST(request: Request) {
  if (rateLimited(request)) return NextResponse.json({ error: "Please wait a few minutes before tagging another photograph." }, { status: 429 });
  const parsed = publicTagSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check the face tag." }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ ok: true });
  const access = await accessFor(parsed.data.mediaId);
  if (!access) return NextResponse.json({ error: "This photograph is not available." }, { status: 404 });
  const width = Math.min(parsed.data.width, 1 - parsed.data.x);
  const height = Math.min(parsed.data.height, 1 - parsed.data.y);
  const { error } = await access.supabase.from("photo_face_tags").insert({
    project_id: access.projectId, media_asset_id: parsed.data.mediaId, person_name: parsed.data.personName,
    x: parsed.data.x, y: parsed.data.y, width, height, status: "suggested", source: "manual", confidence: null
  });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || /photo_face_tags|schema cache/i.test(error.message)) return NextResponse.json({ error: "Photo tagging is being prepared." }, { status: 503 });
    return NextResponse.json({ error: "That face tag could not be saved. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, pendingReview: true }, { status: 201 });
}

export async function GET(request: Request) {
  const parsed = idSchema.safeParse(new URL(request.url).searchParams.get("mediaId"));
  if (!parsed.success) return NextResponse.json({ tags: [] }, { status: 400 });
  const access = await accessFor(parsed.data);
  if (!access) return NextResponse.json({ tags: [] }, { status: 404 });
  const { data, error } = await access.supabase
    .from("photo_face_tags")
    .select("id,person_name,x,y,width,height")
    .eq("project_id", access.projectId)
    .eq("media_asset_id", parsed.data)
    .eq("status", "confirmed")
    .neq("person_name", "")
    .order("x");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || /photo_face_tags|schema cache/i.test(error.message)) return NextResponse.json({ tags: [], unavailable: true });
    return NextResponse.json({ tags: [] }, { status: 500 });
  }
  return NextResponse.json({
    tags: (data ?? []).map(tag => ({ id: tag.id, name: tag.person_name, x: tag.x, y: tag.y, width: tag.width, height: tag.height }))
  }, { headers: { "Cache-Control": "private, max-age=60" } });
}
