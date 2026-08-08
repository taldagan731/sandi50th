import { NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import { isTestContributor } from "@/lib/chapters";
import { buildContributionReport } from "@/lib/studio/contribution-report";
import { hasRevealPreviewAccess } from "@/lib/reveal-preview";
import { getRevealProject } from "@/lib/reveal-visibility";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const previewOwner = !owner && await hasRevealPreviewAccess();
  if (!owner && !previewOwner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const previewProject = owner ? null : await getRevealProject();
  const projectId = owner?.project.id ?? previewProject?.id;
  if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const supabase = owner?.supabase ?? createAdminClient();
  const { data: ownerMembershipRows, error: ownerMembershipError } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("role", "owner")
    .limit(2);
  const ownerMembershipCount = ownerMembershipError ? null : (ownerMembershipRows?.length ?? 0);
  const ownerMembershipCheckError = ownerMembershipError?.code ?? null;

  const { data: submissions, error: submissionError } = await supabase
    .from("submissions")
    .select("id,name,contact,relationship,first_memory,story,approximate_year,location,people,life_chapter,prompt,consent,status,review_status,reviewer_notes,created_at,upload_completed_at")
    .eq("project_id", projectId)
    .not("name", "ilike", "%MOBILE TEST%")
    .not("name", "ilike", "%CODEX%")
    .order("created_at", { ascending: false });
  if (submissionError) {
    return NextResponse.json({ error: submissionError.message }, { status: 500 });
  }

  const visibleSubmissions = (submissions ?? []).filter(item => !isTestContributor(item.name));
  const ids = visibleSubmissions.map(item => item.id);
  let intelligenceAvailable = true;
  let media: Array<Record<string, unknown>> = [];

  if (ids.length) {
    const pageSize = 1000;
    let enrichedError: { code?: string; message: string } | null = null;

    for (let from = 0; ; from += pageSize) {
      const enriched = await supabase
        .from("media_assets")
        .select(intelligenceColumns)
        .in("submission_id", ids)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (enriched.error) {
        enrichedError = enriched.error;
        break;
      }
      const page = (enriched.data ?? []) as unknown as Array<Record<string, unknown>>;
      media.push(...page);
      if (page.length < pageSize) break;
    }

    if (enrichedError) {
      const missingIntelligenceColumns = enrichedError.code === "42703" || /analysis_|exif_|inferred_year|assignment_/i.test(enrichedError.message);
      if (!missingIntelligenceColumns) {
        return NextResponse.json({ error: enrichedError.message }, { status: 500 });
      }
      intelligenceAvailable = false;
      media = [];

      for (let from = 0; ; from += pageSize) {
        const fallback = await supabase
          .from("media_assets")
          .select(baseMediaColumns)
          .in("submission_id", ids)
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (fallback.error) {
          return NextResponse.json({
            error: "The studio migration has not been installed yet.",
            detail: fallback.error.message
          }, { status: 503 });
        }
        const page = (fallback.data ?? []) as unknown as Array<Record<string, unknown>>;
        media.push(...page);
        if (page.length < pageSize) break;
      }
    }
  }

  const mediaBySubmission = new Map<string, Array<Record<string, unknown>>>();
  for (const item of media) {
    const current = mediaBySubmission.get(String(item.submission_id)) ?? [];
    current.push(item);
    mediaBySubmission.set(String(item.submission_id), current);
  }

  const enrichedSubmissions = visibleSubmissions.map(item => ({
    ...item,
    media: mediaBySubmission.get(item.id) ?? []
  }));

  const report = buildContributionReport(enrichedSubmissions);
  if (previewOwner) return NextResponse.json({ intelligenceAvailable, ownerMembershipCount, ownerMembershipCheckError, report });

  return NextResponse.json({
    intelligenceAvailable,
    ownerMembershipCount,
    ownerMembershipCheckError,
    report,
    submissions: enrichedSubmissions
  });
}
