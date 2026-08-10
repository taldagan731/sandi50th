import { NextResponse } from "next/server";
import { requireStudioAccess } from "@/lib/studio/auth";
import { faceTaggingStatus, processNextFacePhoto } from "@/lib/face-tagging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const status = await faceTaggingStatus(owner.project.id);
    return NextResponse.json({ ...status, externalApprovalRequired: process.env.FACE_MATCHING_EXTERNAL_APPROVED !== "true" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Face-tag status could not be loaded." }, { status: 500 });
  }
}

export async function POST() {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (process.env.FACE_MATCHING_EXTERNAL_APPROVED !== "true") {
      return NextResponse.json({ error: "Owner approval is required before reduced face crops are sent to Anthropic for comparison.", externalApprovalRequired: true }, { status: 412 });
    }
    const result = await processNextFacePhoto(owner.project.id);
    const status = await faceTaggingStatus(owner.project.id);
    return NextResponse.json({ result, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI face matching could not continue.";
    return NextResponse.json({ error: message }, { status: /photo_face_tags/i.test(message) ? 503 : 500 });
  }
}
