import { NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import { processPhotoAnalysisJobs } from "@/lib/photo-intelligence";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: submissions, error: submissionError } = await owner.supabase
    .from("submissions")
    .select("id")
    .eq("project_id", owner.project.id)
    .order("created_at");
  if (submissionError) return NextResponse.json({ error: submissionError.message }, { status: 500 });

  const submissionIds = (submissions ?? []).map(item => item.id);
  if (submissionIds.length) {
    const { data: images, error: imageError } = await owner.supabase
      .from("media_assets")
      .select("id,analysis_status,created_at")
      .in("submission_id", submissionIds)
      .like("mime_type", "image/%")
      .order("created_at")
      .limit(250);
    if (imageError) {
      return NextResponse.json({
        error: "Install supabase/photo-intelligence-migration.sql before running the pilot.",
        detail: imageError.message
      }, { status: 503 });
    }

    const pending = (images ?? []).filter(item => !["completed", "review_required"].includes(item.analysis_status || ""));
    if (pending.length) {
      const now = new Date().toISOString();
      const { error: queueError } = await owner.supabase.from("photo_analysis_jobs").upsert(
        pending.map((item, index) => ({
          project_id: owner.project.id,
          media_asset_id: item.id,
          status: "queued",
          pilot_rank: index < 10 ? index + 1 : null,
          next_attempt_at: now
        })),
        { onConflict: "media_asset_id", ignoreDuplicates: true }
      );
      if (queueError) {
        return NextResponse.json({
          error: "Install supabase/photo-intelligence-migration.sql before running the pilot.",
          detail: queueError.message
        }, { status: 503 });
      }
      await owner.supabase
        .from("media_assets")
        .update({ analysis_status: "queued" })
        .in("id", pending.map(item => item.id))
        .in("analysis_status", ["unprocessed", "failed"]);
    }
  }

  const result = await processPhotoAnalysisJobs({ limit: 10, projectId: owner.project.id });
  return NextResponse.json(result, { status: result.available ? 200 : 503 });
}
