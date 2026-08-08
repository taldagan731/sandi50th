import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  matchId: z.string().uuid(),
  action: z.enum(["keep", "exclude"])
});

function tokenMatches(token: string, expectedHash: string | null) {
  if (!token || !expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const actual = Buffer.from(createHash("sha256").update(token).digest("hex"), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function authorize(request: Request, submissionId: string) {
  const supabase = createAdminClient();
  const token = request.headers.get("x-duplicate-review-token") ?? "";
  const { data: submission, error } = await supabase
    .from("submissions")
    .select("id,duplicate_review_token_hash")
    .eq("id", submissionId)
    .single();
  if (error || !submission || !tokenMatches(token, submission.duplicate_review_token_hash)) return null;
  return { supabase, submission };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: submissionId } = await context.params;
  const authorized = await authorize(request, submissionId);
  if (!authorized) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { supabase } = authorized;

  const { data: mine, error: mediaError } = await supabase
    .from("media_assets")
    .select("id,original_name,bytes,image_width,image_height,hash_status")
    .eq("submission_id", submissionId)
    .like("mime_type", "image/%");
  if (mediaError) return NextResponse.json({ error: "Photo review is not available yet." }, { status: 503 });

  const mineById = new Map((mine ?? []).map(item => [item.id, item]));
  const sourceIds = [...mineById.keys()];
  if (!sourceIds.length) return NextResponse.json({ matches: [], pending: false });

  const { data: matches, error: matchError } = await supabase
    .from("media_duplicate_matches")
    .select("id,source_media_id,candidate_media_id,confidence")
    .in("source_media_id", sourceIds)
    .eq("match_kind", "near")
    .eq("contributor_visible", true)
    .eq("contributor_action", "unreviewed")
    .eq("studio_status", "open")
    .order("confidence", { ascending: false });
  if (matchError) return NextResponse.json({ error: "Photo review is not available yet." }, { status: 503 });

  const candidateIds = [...new Set((matches ?? []).map(item => item.candidate_media_id))];
  const { data: candidates } = candidateIds.length
    ? await supabase
        .from("media_assets")
        .select("id,original_name,bytes,image_width,image_height")
        .in("id", candidateIds)
    : { data: [] };
  const candidateById = new Map((candidates ?? []).map(item => [item.id, item]));

  const responseMatches = (matches ?? []).flatMap(match => {
    const source = mineById.get(match.source_media_id);
    const candidate = candidateById.get(match.candidate_media_id);
    if (!source || !candidate) return [];
    const imageBase = `/api/submissions/${submissionId}/duplicates/media`;
    return [{
      id: match.id,
      confidence: Number(match.confidence),
      mine: {
        mediaId: source.id,
        name: source.original_name,
        width: source.image_width,
        height: source.image_height,
        bytes: Number(source.bytes),
        src: `${imageBase}/${source.id}`
      },
      collection: {
        mediaId: candidate.id,
        name: candidate.original_name,
        width: candidate.image_width,
        height: candidate.image_height,
        bytes: Number(candidate.bytes),
        src: `${imageBase}/${candidate.id}`
      }
    }];
  });

  const pending = (mine ?? []).some(item => ["unprocessed", "queued", "processing"].includes(item.hash_status || ""));
  return NextResponse.json({ matches: responseMatches, pending });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: submissionId } = await context.params;
  const authorized = await authorize(request, submissionId);
  if (!authorized) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { supabase } = authorized;
  const body = decisionSchema.parse(await request.json());

  const { data: source } = await supabase
    .from("media_assets")
    .select("id")
    .eq("submission_id", submissionId);
  const sourceIds = (source ?? []).map(item => item.id);
  if (!sourceIds.length) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: match, error: matchError } = await supabase
    .from("media_duplicate_matches")
    .select("id,source_media_id")
    .eq("id", body.matchId)
    .in("source_media_id", sourceIds)
    .eq("contributor_visible", true)
    .eq("studio_status", "open")
    .single();
  if (matchError || !match) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { error: decisionError } = await supabase
    .from("media_duplicate_matches")
    .update({
      contributor_action: body.action,
      resolved_at: new Date().toISOString()
    })
    .eq("id", match.id);
  if (decisionError) return NextResponse.json({ error: "The choice could not be saved." }, { status: 500 });

  if (body.action === "exclude") {
    const { error: excludeError } = await supabase
      .from("media_assets")
      .update({
        contributor_duplicate_action: "exclude",
        review_status: "excluded"
      })
      .eq("id", match.source_media_id);
    if (excludeError) return NextResponse.json({ error: "The photograph remains stored, but its reveal setting could not be changed." }, { status: 500 });
  } else {
    await supabase
      .from("media_assets")
      .update({ contributor_duplicate_action: "keep" })
      .eq("id", match.source_media_id);
  }

  return NextResponse.json({ ok: true, retained: true, action: body.action });
}
