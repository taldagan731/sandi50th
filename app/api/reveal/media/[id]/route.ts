import { head } from "@vercel/blob";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudioOwner } from "@/lib/studio/auth";
import { isTestContributor } from "@/lib/chapters";
import { hasRevealPreviewAccess } from "@/lib/reveal-preview";
import { getRevealShareAccess } from "@/lib/reveal-share";
import { getRevealProject } from "@/lib/reveal-visibility";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const owner = await requireStudioOwner();
  const ownerPreview = !owner && await hasRevealPreviewAccess();
  const guestShare = !owner && !ownerPreview ? await getRevealShareAccess() : null;
  const supabase = owner?.supabase ?? createAdminClient();

  let projectId = owner?.project.id ?? null;
  if (!projectId) {
    const project = await getRevealProject();
    const guestCanView = Boolean(guestShare && project && guestShare.projectId === project.id);
    if (!project || (!ownerPreview && !guestCanView && !project.revealPublic)) return new NextResponse("Not found", { status: 404 });
    projectId = project.id;
  }

  const { id } = await context.params;
  const { data: media, error } = await supabase
    .from("media_assets")
    .select("id,submission_id,storage_path,poster_path,mime_type,original_name,review_status")
    .eq("id", id)
    .single();
  if (error || !media || (!owner && media.review_status === "excluded")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: submission } = await supabase
    .from("submissions")
    .select("project_id,name,review_status")
    .eq("id", media.submission_id)
    .eq("project_id", projectId)
    .single();
  if (!submission || (!owner && (submission.review_status === "excluded" || isTestContributor(submission.name)))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const searchParams = new URL(request.url).searchParams;
  const downloadOriginal = searchParams.get("download") === "1";
  const presentationImage = media.mime_type.startsWith("image/") && media.poster_path && !downloadOriginal;
  const requestedVideoPoster = searchParams.get("poster") === "1" && media.poster_path;
  const requestedPath = presentationImage || requestedVideoPoster ? media.poster_path! : media.storage_path;

  if (!requestedPath.startsWith("incoming/") && !requestedPath.startsWith("posters/")) {
    const { data, error: signedError } = await supabase.storage
      .from("sandi-memories")
      .createSignedUrl(requestedPath, 60);
    if (signedError || !data) return new NextResponse("Not found", { status: 404 });
    return NextResponse.redirect(data.signedUrl);
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return new NextResponse("Storage is not configured", { status: 503 });

  const blob = await head(requestedPath);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const range = request.headers.get("range");
  if (range) headers.Range = range;
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) headers["If-None-Match"] = ifNoneMatch;

  const response = await fetch(blob.url, { headers });
  const requestedWidthParam = searchParams.get("width");
  const requestedWidth = Number(requestedWidthParam);
  const presentationWidth = presentationImage && requestedWidthParam !== null && Number.isFinite(requestedWidth)
    ? Math.min(1600, Math.max(320, Math.round(requestedWidth)))
    : null;
  if (presentationWidth && response.ok) {
    const resized = await sharp(Buffer.from(await response.arrayBuffer()), { failOn: "none" })
      .resize({ width: presentationWidth, withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();
    return new NextResponse(new Uint8Array(resized), {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
        "Content-Type": "image/jpeg",
        "Content-Length": String(resized.length),
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const outgoing = new Headers();
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = response.headers.get(name);
    if (value) outgoing.set(name, value);
  }
  outgoing.set("Cache-Control", downloadOriginal ? "private, no-store" : "private, max-age=3600, stale-while-revalidate=86400");
  outgoing.set("X-Content-Type-Options", "nosniff");
  const safeFilename = media.original_name.replace(/[^\x20-\x7E]/g, "_").replace(/[\\"]/g, "_").slice(0, 180) || "memory";
  const disposition = downloadOriginal ? "attachment" : "inline";
  const responseFilename = requestedPath === media.poster_path
    ? `${safeFilename.replace(/\.[^.]+$/, "") || "photograph"}.jpg`
    : safeFilename;
  outgoing.set("Content-Disposition", `${disposition}; filename="${responseFilename}"`);

  return new NextResponse(response.body, { status: response.status, headers: outgoing });
}
