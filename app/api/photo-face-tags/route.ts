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
