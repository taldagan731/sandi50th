import { NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";

const baseMediaColumns = "id,submission_id,storage_path,original_name,mime_type,bytes,review_status,chapter_number,caption,reviewer_notes,poster_path,display_order,reviewed_at,created_at";
const intelligenceColumns = [
  baseMediaColumns,
  "exif_status",
  "exif_captured_at",
  "exif_latitude",
  "exif_longitude",
  "analysis_status",
  "analysis_era",
  "analysis_decade",
  "analysis_setting",
  "analysis_people_count",
  "analysis_composition",
  "analysis_description",
  "analysis_objects",
  "analysis_occasion_markers",
  "analysis_event_clues",
  "analysis_confidence",
  "analysis_error",
  "analysis_completed_at",
  "inferred_year_start",
  "inferred_year_end",
  "date_inference_source",
  "assignment_confidence",
  "assignment_rationale"
].join(",");

export async function GET() {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: submissions, error: submissionError } = await owner.supabase
    .from("submissions")
    .select("id,name,contact,relationship,first_memory,story,approximate_year,location,people,life_chapter,prompt,consent,status,review_status,reviewer_notes,created_at,upload_completed_at")
    .eq("project_id", owner.project.id)
    .order("created_at", { ascending: false });
  if (submissionError) {
    return NextResponse.json({ error: submissionError.message }, { status: 500 });
  }

  const ids = submissions?.map(item => item.id) ?? [];
  let intelligenceAvailable = true;
  let media: Array<Record<string, unknown>> = [];

  if (ids.length) {
    const enriched = await owner.supabase
      .from("media_assets")
      .select(intelligenceColumns)
      .in("submission_id", ids)
      .order("display_order", { ascending: true });

    if (enriched.error) {
      const missingIntelligenceColumns = enriched.error.code === "42703" || /analysis_|exif_|inferred_year|assignment_/i.test(enriched.error.message);
      if (!missingIntelligenceColumns) {
        return NextResponse.json({ error: enriched.error.message }, { status: 500 });
      }
      intelligenceAvailable = false;
      const fallback = await owner.supabase
        .from("media_assets")
        .select(baseMediaColumns)
        .in("submission_id", ids)
        .order("display_order", { ascending: true });
      if (fallback.error) {
        return NextResponse.json({
          error: "The studio migration has not been installed yet.",
          detail: fallback.error.message
        }, { status: 503 });
      }
      media = fallback.data ?? [];
    } else {
      media = enriched.data ?? [];
    }
  }

  const mediaBySubmission = new Map<string, Array<Record<string, unknown>>>();
  for (const item of media) {
    const current = mediaBySubmission.get(String(item.submission_id)) ?? [];
    current.push(item);
    mediaBySubmission.set(String(item.submission_id), current);
  }

  return NextResponse.json({
    intelligenceAvailable,
    submissions: (submissions ?? []).map(item => ({
      ...item,
      media: mediaBySubmission.get(item.id) ?? []
    }))
  });
}
