import { head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_CONTRIBUTOR = /(?:MOBILE TEST|CODEX)/i;

export async function GET() {
  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", "sandi50th")
    .single();
  if (!project) return new NextResponse("No approved photograph is available.", { status: 404 });

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id,name")
    .eq("project_id", project.id);
  const eligibleIds = (submissions ?? [])
    .filter(item => !TEST_CONTRIBUTOR.test(item.name ?? ""))
    .map(item => item.id);
  if (!eligibleIds.length) return new NextResponse("No approved photograph is available.", { status: 404 });

  const { data: media } = await supabase
    .from("media_assets")
    .select("storage_path,mime_type")
    .in("submission_id", eligibleIds)
    .eq("review_status", "included")
    .like("mime_type", "image/%")
    .order("display_order", { ascending: true })
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!media) return new NextResponse("No approved photograph is available.", { status: 404 });

  let response: Response;
  if (media.storage_path.startsWith("incoming/")) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return new NextResponse("Storage is unavailable.", { status: 503 });
    const blob = await head(media.storage_path);
    response = await fetch(blob.url, { headers: { Authorization: `Bearer ${token}` } });
  } else {
    const { data: signed } = await supabase.storage
      .from("sandi-memories")
      .createSignedUrl(media.storage_path, 60);
    if (!signed) return new NextResponse("Photograph is unavailable.", { status: 404 });
    response = await fetch(signed.signedUrl);
  }
  if (!response.ok || !response.body) return new NextResponse("Photograph is unavailable.", { status: 502 });

  const headers = new Headers({
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
    "Content-Type": response.headers.get("content-type") || media.mime_type,
    "X-Content-Type-Options": "nosniff"
  });
  for (const name of ["content-length", "etag", "last-modified"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(response.body, { status: 200, headers });
}
