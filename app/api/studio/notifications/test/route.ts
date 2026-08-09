import { NextResponse } from "next/server";
import { sendContributionArrivalEmail } from "@/lib/notifications/contribution-email";
import { requireStudioAccess } from "@/lib/studio/auth";

export const runtime = "nodejs";

export async function POST() {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await sendContributionArrivalEmail({
      submissionId: "studio-notification-test",
      contributorName: "Studio notification test",
      relationship: "System check",
      prompt: null,
      lifeChapter: null,
      fileCount: 0,
      receivedAt: new Date().toISOString()
    });
    if (!result.sent) {
      return NextResponse.json({
        error: "Arrival email is not fully configured.",
        detail: result.reason
      }, { status: 503 });
    }
    return NextResponse.json({ sent: true });
  } catch (error) {
    return NextResponse.json({
      error: "The test notification could not be delivered.",
      detail: error instanceof Error ? error.message : "Unknown email error"
    }, { status: 502 });
  }
}
