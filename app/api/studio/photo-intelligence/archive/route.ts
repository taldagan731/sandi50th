import { NextResponse } from "next/server";
import { requireStudioAccess } from "@/lib/studio/auth";
import {
  applyChapterFallbacks,
  globalPhotoArchiveStatus,
  prepareGlobalPhotoArchive,
  processPhotoAnalysisJobs
} from "@/lib/photo-intelligence";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prepared = await prepareGlobalPhotoArchive();
  if (!prepared.available || !prepared.projectId) {
    return NextResponse.json({ error: "The archive could not be prepared.", detail: prepared.error }, { status: 503 });
  }
  const fallback = await applyChapterFallbacks(prepared.projectId);
  if (!fallback.available) return NextResponse.json({ error: "Initial chapter placement failed.", detail: fallback.error }, { status: 503 });
  const before = await globalPhotoArchiveStatus(prepared.projectId);
  const result = before.remaining > 0
    ? await processPhotoAnalysisJobs({ limit: Math.min(6, before.remaining), projectId: prepared.projectId })
    : { available: true, processed: [] };
  const archive = await globalPhotoArchiveStatus(prepared.projectId);
  return NextResponse.json({ available: result.available, queued: prepared.queued, fallback, processed: result.processed, archive }, { status: result.available ? 200 : 503 });
}
