import { createHash, timingSafeEqual } from "node:crypto";
import { head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenMatches(token: string, expectedHash: string | null) {
  if (!token || !expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const actual = Buffer.from(createHash("sha256").update(token).digest("hex"), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; mediaId: string }> }
) {
  const { id: submissionId, mediaId } = await context.params;
  const supabase = createAdminClient();
  const token = request.headers.get("x-duplicate-review-token")
    ?? new URL(request.url).searchParams.get("token")
    ?? "";
  const { data: submission } = await supabase
    .from("submissions")
    .select("duplicate_review_token_hash")
    .eq("id", submissionId)
    .single();
  if (!submission || !tokenMatches(token, submission.duplicate_review_token_hash)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: sourceRows } = await supabase
    .from("media_assets")
    .select("id")
    .eq("submission_id", submissionId)
    .like("mime_type", "image/%");
  const sourceIds = (sourceRows ?? []).map(item => item.id);
  if (!sourceIds.length) return new NextResponse("Not found", { status: 404 });

  let allowed = sourceIds.includes(mediaId);
  if (!allowed) {
    const { data: match } = await supabase
      .from("media_duplicate_matches")
      .select("id")
      .in("source_media_id", sourceIds)
      .eq("candidate_media_id", mediaId)
      .eq("contributor_visible", true)
      .limit(1);
    allowed = Boolean(match?.length);
  }
  if (!allowed) return new NextResponse("Not found", { status: 404 });

  const { data: media } = await supabase
    .from("media_assets")
    .select("storage_path,mime_type,original_name")
    .eq("id", mediaId)
    .single();
  if (!media || !String(media.mime_type).startsWith("image/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!media.storage_path.startsWith("incoming/")) {
    const { data } = await supabase.storage.from("sandi-memories").createSignedUrl(media.storage_path, 60);
    return data ? NextResponse.redirect(data.signedUrl) : new NextResponse("Not found", { status: 404 });
  }

  const storageToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!storageToken) return new NextResponse("Storage is not configured", { status: 503 });
  const blob = await head(media.storage_path);
  const response = await fetch(blob.url, {
    headers: { Authorization: `Bearer ${storageToken}` },
    cache: "no-store"
  });
  const headers = new Headers();
  headers.set("Content-Type", response.headers.get("content-type") || media.mime_type);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new NextResponse(response.body, { status: response.status, headers });
}
