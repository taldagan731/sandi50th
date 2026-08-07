import { head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const { data: media, error } = await owner.supabase
    .from("media_assets")
    .select("id,submission_id,storage_path,poster_path,mime_type,original_name")
    .eq("id", id)
    .single();
  if (error || !media) return new NextResponse("Not found", { status: 404 });

  const { data: submission } = await owner.supabase
    .from("submissions")
    .select("project_id")
    .eq("id", media.submission_id)
    .eq("project_id", owner.project.id)
    .single();
  if (!submission) return new NextResponse("Not found", { status: 404 });

  const requestedPath = new URL(request.url).searchParams.get("poster") === "1" && media.poster_path
    ? media.poster_path
    : media.storage_path;

  if (!requestedPath.startsWith("incoming/") && !requestedPath.startsWith("posters/")) {
    const { data, error: signedError } = await owner.supabase.storage
      .from("sandi-memories")
      .createSignedUrl(requestedPath, 60);
    if (signedError || !data) return new NextResponse("Not found", { status: 404 });
    return NextResponse.redirect(data.signedUrl);
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return new NextResponse("Storage is not configured", { status: 503 });

  const blob = await head(requestedPath);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`
  };
  const range = request.headers.get("range");
  if (range) headers.Range = range;
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) headers["If-None-Match"] = ifNoneMatch;

  const response = await fetch(blob.url, { headers });
  const outgoing = new Headers();
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = response.headers.get(name);
    if (value) outgoing.set(name, value);
  }
  outgoing.set("Cache-Control", "private, no-store");
  outgoing.set("X-Content-Type-Options", "nosniff");
  const safeFilename = media.original_name.replace(/[^\x20-\x7E]/g, "_").replace(/[\\"]/g, "_").slice(0, 180) || "memory";
  outgoing.set("Content-Disposition", `inline; filename="${safeFilename}"`);

  return new NextResponse(response.body, {
    status: response.status,
    headers: outgoing
  });
}
