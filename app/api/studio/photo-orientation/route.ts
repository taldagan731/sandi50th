import { NextResponse } from "next/server";
import { z } from "zod";
import { createImageDerivative, isImageMedia, type DerivativeMedia } from "@/lib/media-derivatives";
import { detectOriginalOrientation, manualRotationFromNotes, notesWithManualRotation } from "@/lib/media-orientation";
import { readPrivateMedia } from "@/lib/photo-intelligence/media";
import { requireStudioAccess } from "@/lib/studio/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("scan"), offset: z.number().int().min(0), limit: z.number().int().min(1).max(8).default(4) }),
  z.object({ action: z.literal("rotate"), mediaId: z.string().uuid(), direction: z.enum(["left", "right"]) })
]);

type PhotoRow = DerivativeMedia & { reviewer_notes: string | null; created_at: string };

async function ownerPhotos(owner: NonNullable<Awaited<ReturnType<typeof requireStudioAccess>>>) {
  const { data: submissions, error: submissionError } = await owner.supabase
    .from("submissions")
    .select("id,name")
    .eq("project_id", owner.project.id);
  if (submissionError) throw submissionError;
  const names = new Map((submissions ?? []).map(item => [item.id, item.name]));
  const ids = [...names.keys()];
  if (!ids.length) return [];
  const { data, error } = await owner.supabase
    .from("media_assets")
    .select("id,submission_id,storage_path,original_name,mime_type,bytes,poster_path,chapter_number,reviewer_notes,created_at")
    .in("submission_id", ids)
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as PhotoRow[])
    .filter(isImageMedia)
    .map(item => ({ ...item, contributorName: names.get(item.submission_id) || "Unknown contributor" }));
}

export async function GET() {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const photos = await ownerPhotos(owner);
    return NextResponse.json({
      total: photos.length,
      photos: photos.map(item => ({
        id: item.id,
        originalName: item.original_name,
        contributorName: item.contributorName,
        chapterNumber: item.chapter_number,
        posterReady: Boolean(item.poster_path),
        manualRotation: manualRotationFromNotes(item.reviewer_notes)
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Photographs could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = schema.parse(await request.json());
    const photos = await ownerPhotos(owner);
    if (body.action === "scan") {
      const batch = photos.slice(body.offset, body.offset + body.limit);
      const results = [];
      for (const media of batch) {
        try {
          const original = await readPrivateMedia(owner.supabase, media.storage_path);
          const orientation = await detectOriginalOrientation(original);
          if (orientation === 1) {
            results.push({ id: media.id, name: media.original_name, orientation, affected: false, repaired: false });
            continue;
          }
          const repair = await createImageDerivative(owner.supabase, media, { force: true });
          const repaired = repair.status === "converted";
          let servedOrientation: number | null = null;
          if (repaired && repair.derivativePath) {
            const derivative = await readPrivateMedia(owner.supabase, repair.derivativePath);
            servedOrientation = await detectOriginalOrientation(derivative);
          }
          results.push({
            id: media.id,
            name: media.original_name,
            orientation,
            affected: true,
            repaired,
            servedOrientation,
            error: repair.error ?? null
          });
        } catch (error) {
          results.push({ id: media.id, name: media.original_name, affected: false, repaired: false, error: error instanceof Error ? error.message : "Scan failed" });
        }
      }
      return NextResponse.json({ ok: true, total: photos.length, offset: body.offset, nextOffset: body.offset + batch.length, results });
    }

    const media = photos.find(item => item.id === body.mediaId);
    if (!media) return NextResponse.json({ error: "Photograph not found." }, { status: 404 });
    const current = manualRotationFromNotes(media.reviewer_notes);
    const next = (current + (body.direction === "right" ? 90 : 270)) % 360;
    const reviewerNotes = notesWithManualRotation(media.reviewer_notes, next);
    const repair = await createImageDerivative(owner.supabase, { ...media, reviewer_notes: reviewerNotes }, { force: true });
    if (repair.status !== "converted") return NextResponse.json({ error: repair.error || "The corrected derivative could not be created." }, { status: 500 });
    const { error } = await owner.supabase.from("media_assets").update({ reviewer_notes: reviewerNotes }).eq("id", media.id);
    if (error) throw error;
    return NextResponse.json({ ok: true, id: media.id, manualRotation: next, version: Date.now() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Photo orientation could not be changed." }, { status: 400 });
  }
}
