import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioOwner } from "@/lib/studio/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  action: z.enum(["merge", "different"]),
  mediaIds: z.array(z.string().uuid()).min(2).max(50)
});

export async function GET() {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: matches, error } = await owner.supabase
    .from("media_duplicate_matches")
    .select("id,source_media_id,candidate_media_id,match_kind,hamming_distance,confidence,contributor_action,studio_status,created_at")
    .eq("project_id", owner.project.id)
    .order("confidence", { ascending: false });
  if (error) {
    const migrationMissing = error.code === "42P01" || /media_duplicate_matches/i.test(error.message);
    return NextResponse.json({
      available: false,
      matches: [],
      media: [],
      error: migrationMissing ? "The duplicate-detection migration has not been installed yet." : error.message
    }, { status: migrationMissing ? 200 : 500 });
  }

  const mediaIds = [...new Set((matches ?? []).flatMap(item => [item.source_media_id, item.candidate_media_id]))];
  const { data: media } = mediaIds.length
    ? await owner.supabase
        .from("media_assets")
        .select("id,submission_id,original_name,bytes,image_width,image_height,canonical_media_id,review_status,created_at")
        .in("id", mediaIds)
    : { data: [] };
  const submissionIds = [...new Set((media ?? []).map(item => item.submission_id))];
  const { data: submissions } = submissionIds.length
    ? await owner.supabase.from("submissions").select("id,name,relationship").in("id", submissionIds)
    : { data: [] };

  return NextResponse.json({
    available: true,
    matches: matches ?? [],
    media: media ?? [],
    submissions: submissions ?? [],
    counts: {
      open: (matches ?? []).filter(item => item.studio_status === "open").length,
      exact: (matches ?? []).filter(item => item.match_kind === "exact").length,
      merged: (matches ?? []).filter(item => item.studio_status === "merged").length,
      different: (matches ?? []).filter(item => item.studio_status === "different").length
    }
  });
}

export async function POST(request: Request) {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = decisionSchema.parse(await request.json());
  const mediaIds = [...new Set(body.mediaIds)];

  const { data: media, error: mediaError } = await owner.supabase
    .from("media_assets")
    .select("id,submission_id,bytes,image_width,image_height,canonical_media_id,created_at")
    .in("id", mediaIds);
  if (mediaError || !media || media.length !== mediaIds.length) {
    return NextResponse.json({ error: "One or more photographs could not be found." }, { status: 404 });
  }

  const submissionIds = [...new Set(media.map(item => item.submission_id))];
  const { data: submissions } = await owner.supabase
    .from("submissions")
    .select("id,project_id")
    .in("id", submissionIds)
    .eq("project_id", owner.project.id);
  if (!submissions || submissions.length !== submissionIds.length) {
    return NextResponse.json({ error: "The photographs do not belong to this archive." }, { status: 403 });
  }

  const { data: allMatches, error: matchesError } = await owner.supabase
    .from("media_duplicate_matches")
    .select("id,source_media_id,candidate_media_id")
    .eq("project_id", owner.project.id);
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 });
  const selected = new Set(mediaIds);
  const matchIds = (allMatches ?? [])
    .filter(match => selected.has(match.source_media_id) && selected.has(match.candidate_media_id))
    .map(match => match.id);
  if (!matchIds.length) return NextResponse.json({ error: "No comparison group was found." }, { status: 404 });

  const resolvedAt = new Date().toISOString();
  if (body.action === "different") {
    const { error: updateError } = await owner.supabase
      .from("media_duplicate_matches")
      .update({ studio_status: "different", resolved_at: resolvedAt })
      .in("id", matchIds);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: "different", originalsRetained: media.length });
  }

  const ranked = [...media].sort((left, right) => {
    const leftPixels = Number(left.image_width || 0) * Number(left.image_height || 0);
    const rightPixels = Number(right.image_width || 0) * Number(right.image_height || 0);
    return rightPixels - leftPixels
      || Number(right.bytes) - Number(left.bytes)
      || String(left.created_at).localeCompare(String(right.created_at));
  });
  const winner = ranked[0];
  const canonicalId = winner.canonical_media_id ?? winner.id;
  const loserIds = ranked.slice(1).map(item => item.id);
  if (loserIds.length) {
    const { error: canonicalError } = await owner.supabase
      .from("media_assets")
      .update({ canonical_media_id: canonicalId })
      .in("id", loserIds);
    if (canonicalError) return NextResponse.json({ error: canonicalError.message }, { status: 500 });
  }
  const { error: mergeError } = await owner.supabase
    .from("media_duplicate_matches")
    .update({ studio_status: "merged", resolved_at: resolvedAt })
    .in("id", matchIds);
  if (mergeError) return NextResponse.json({ error: mergeError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    action: "merge",
    canonicalMediaId: canonicalId,
    originalsRetained: media.length,
    creditedSubmissions: submissionIds.length
  });
}
