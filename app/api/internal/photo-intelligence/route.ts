import { NextResponse } from "next/server";
import { processPhotoAnalysisJobs } from "@/lib/photo-intelligence";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processPhotoAnalysisJobs({ limit: 3 });
  return NextResponse.json(result, { status: result.available ? 200 : 503 });
}
