import { NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import { processPhotoAnalysisJobs } from "@/lib/photo-intelligence";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await processPhotoAnalysisJobs({ limit: 10, projectId: owner.project.id });
  return NextResponse.json(result, { status: result.available ? 200 : 503 });
}
