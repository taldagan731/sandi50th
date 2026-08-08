import { NextResponse } from "next/server";
import {
  globalPhotoPilotStatus,
  prepareGlobalPhotoPilot,
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

  const prepared = await prepareGlobalPhotoPilot(10);
  if (!prepared.available || !prepared.projectId) {
    return NextResponse.json(prepared, { status: 503 });
  }

  const before = await globalPhotoPilotStatus();
  if (!before.available) return NextResponse.json(before, { status: 503 });
  if (before.remaining === 0) {
    return NextResponse.json({ available: true, pilotComplete: true, pilot: before, processed: [] });
  }

  const result = await processPhotoAnalysisJobs({
    limit: Math.min(3, before.remaining),
    projectId: prepared.projectId
  });
  const after = await globalPhotoPilotStatus();
  return NextResponse.json({
    ...result,
    pilotComplete: after.remaining === 0,
    pilot: after
  }, { status: result.available ? 200 : 503 });
}
