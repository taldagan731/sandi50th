import { NextResponse } from "next/server";
import {
  applyChapterFallbacks,
  globalPhotoArchiveStatus,
  prepareGlobalPhotoArchive,
  processPhotoAnalysisJobs
} from "@/lib/photo-intelligence";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prepared = await prepareGlobalPhotoArchive();
  if (!prepared.available || !prepared.projectId) {
    return NextResponse.json(prepared, { status: 503 });
  }
  const fallback = await applyChapterFallbacks(prepared.projectId);
  if (!fallback.available) return NextResponse.json(fallback, { status: 503 });
  const before = await globalPhotoArchiveStatus(prepared.projectId);
  if (!before.available) return NextResponse.json(before, { status: 503 });
  if (before.remaining === 0) {
    return NextResponse.json({ available: true, archiveComplete: true, archive: before, fallback, processed: [] });
  }
  const result = await processPhotoAnalysisJobs({
    limit: Math.min(6, before.remaining),
    projectId: prepared.projectId
  });
  const after = await globalPhotoArchiveStatus(prepared.projectId);
  return NextResponse.json({
    ...result,
    archiveComplete: after.remaining === 0,
    archive: after,
    fallback
  }, { status: result.available ? 200 : 503 });
}
