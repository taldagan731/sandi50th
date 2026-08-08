import { NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import {
  globalPhotoPilotStatus,
  prepareGlobalPhotoPilot,
  processPhotoAnalysisJobs
} from "@/lib/photo-intelligence";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prepared = await prepareGlobalPhotoPilot(10);
  if (!prepared.available || !prepared.projectId) {
    return NextResponse.json({
      error: "The ten-photo pilot could not be prepared.",
      detail: prepared.error
    }, { status: 503 });
  }

  const before = await globalPhotoPilotStatus();
  const result = before.remaining > 0
    ? await processPhotoAnalysisJobs({
        limit: Math.min(10, before.remaining),
        projectId: prepared.projectId
      })
    : { available: true, processed: [] };
  const status = await globalPhotoPilotStatus();

  return NextResponse.json({
    available: result.available,
    selected: prepared.selected,
    processed: result.processed,
    pilot: status
  }, { status: result.available ? 200 : 503 });
}
