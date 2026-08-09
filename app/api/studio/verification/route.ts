import { list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isTestContributor } from "@/lib/chapters";
import { hasRevealPreviewAccess } from "@/lib/reveal-preview";
import { getRevealProject } from "@/lib/reveal-visibility";
import { requireStudioOwner } from "@/lib/studio/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const owner = await requireStudioOwner();
  const previewOwner = !owner && await hasRevealPreviewAccess();
  if (!owner && !previewOwner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = owner?.project ?? await getRevealProject();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const supabase = owner?.supabase ?? createAdminClient();
  const { data: submissions, error: submissionError } = await supabase
    .from("submissions")
    .select("id,name,status,created_at,upload_completed_at")
    .eq("project_id", project.id)
    .order("created_at");
  if (submissionError) return NextResponse.json({ error: submissionError.message }, { status: 500 });

  const realSubmissions = (submissions ?? []).filter(item => !isTestContributor(item.name));
  const realIds = realSubmissions.map(item => item.id);
  const { data: media, error: mediaError } = realIds.length
    ? await supabase.from("media_assets").select("id,submission_id,mime_type,poster_path").in("submission_id", realIds)
    : { data: [], error: null };
  if (mediaError) return NextResponse.json({ error: mediaError.message }, { status: 500 });

  const backupPaths: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "backups/", limit: 1000, cursor });
    backupPaths.push(...page.blobs.map(blob => blob.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const backupPathSet = new Set(backupPaths);
  const completed = realSubmissions.filter(item => Boolean(item.upload_completed_at));
  const incomplete = realSubmissions.filter(item => !item.upload_completed_at);
  const missingManifestIds = completed
    .filter(item => !backupPathSet.has(`backups/${item.id}/manifest.json`))
    .map(item => item.id);
  const mediaBackupCount = backupPaths.filter(path => {
    const match = /^backups\/([^/]+)\/media\//.exec(path);
    return Boolean(match && realIds.includes(match[1]));
  }).length;
  const videoRows = (media ?? []).filter(item => String(item.mime_type).startsWith("video/"));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    contributions: {
      started: realSubmissions.length,
      completed: completed.length,
      incomplete: incomplete.length,
      incompleteIds: incomplete.map(item => item.id)
    },
    media: {
      total: media?.length ?? 0,
      videos: videoRows.length,
      videosWithPoster: videoRows.filter(item => Boolean(item.poster_path)).length,
      videosWithoutPoster: videoRows.filter(item => !item.poster_path).map(item => item.id)
    },
    backups: {
      location: "Vercel Blob private backups/ namespace",
      completedSubmissionCount: completed.length,
      manifestCount: completed.length - missingManifestIds.length,
      missingManifestCount: missingManifestIds.length,
      missingManifestIds,
      mediaCopyCount: mediaBackupCount,
      sourceMediaCount: media?.length ?? 0
    }
  });
}
