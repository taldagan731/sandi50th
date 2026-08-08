import { NextResponse } from "next/server";
import { prepareHashBackfill, processHashJobs } from "@/lib/duplicate-detection";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prepared = await prepareHashBackfill(1000);
  if (!prepared.available || !prepared.projectId) {
    return NextResponse.json(prepared, { status: 503 });
  }
  const result = await processHashJobs({ limit: 8, projectId: prepared.projectId });
  return NextResponse.json({
    ...result,
    queuedByBackfill: prepared.queued
  }, { status: result.available ? 200 : 503 });
}
