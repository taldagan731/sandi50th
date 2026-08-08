import type { Metadata } from "next";
import Link from "next/link";
import { RevealExperience } from "@/components/RevealExperience";
import { STORY_CHAPTERS, isTestContributor } from "@/lib/chapters";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudioOwner } from "@/lib/studio/auth";
import "./reveal-recordings.css";
import "./reveal-archive.css";
import "./chapter-nine.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Still Becoming — Private Reveal",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true }
};

type MediaRow = {
  id: string;
  submission_id: string;
  original_name: string;
  mime_type: string;
  caption: string | null;
  chapter_number: number | null;
  poster_path: string | null;
  display_order: number;
  inferred_year_start?: number | null;
  inferred_year_end?: number | null;
  date_inference_source?: string | null;
};

function contributorYearRange(value: string | null | undefined) {
  if (!value) return null;
  const range = value.match(/\b((?:19|20)\d{2})\s*[–—-]\s*((?:19|20)\d{2})\b/);
  if (range) return { start: Number(range[1]), end: Number(range[2]) };
  const decade = value.match(/\b((?:19|20)\d)0s\b/i);
  if (decade) {
    const start = Number(`${decade[1]}0`);
    const lower = value.toLowerCase();
    if (lower.includes("early")) return { start, end: start + 3 };
    if (lower.includes("mid")) return { start: start + 3, end: start + 6 };
    if (lower.includes("late")) return { start: start + 6, end: start + 9 };
    return { start, end: start + 9 };
  }
  const exact = value.match(/\b((?:19|20)\d{2})\b/);
  return exact ? { start: Number(exact[1]), end: Number(exact[1]) } : null;
}

function LockedReveal() {
  return (
    <main className="revealLocked">
      <section>
        <span className="eyebrow">PRIVATE REVEAL</span>
        <h1>This story opens on August 11.</h1>
        <p>Until then, only the project owner can open the film and living archive.</p>
        <Link className="primary" href="/studio">Open Story Studio</Link>
      </section>
    </main>
  );
}

export default async function RevealPage() {
  const owner = await requireStudioOwner();
  const supabase = owner?.supabase ?? createAdminClient();
  let projectId = owner?.project.id ?? null;

  if (!owner) {
    const { data: publicProject, error: projectError } = await supabase
      .from("projects")
      .select("id,reveal_public")
      .eq("slug", "sandi50th")
      .single();
    if (projectError || !publicProject?.reveal_public) return <LockedReveal />;
    projectId = publicProject.id;
  }
  if (!projectId) return <LockedReveal />;

  const { data: chapterRows } = await supabase
    .from("story_chapters")
    .select("chapter_number,title,approved_text,status")
    .eq("project_id", projectId)
    .eq("status", "approved")
    .order("chapter_number");
  const approvedByNumber = new Map((chapterRows ?? []).map(item => [item.chapter_number, item]));

  const { data: rawSubmissions } = await supabase
    .from("submissions")
    .select("id,name,relationship,prompt,approximate_year,review_status")
    .eq("project_id", projectId)
    .neq("review_status", "excluded")
    .not("name", "ilike", "%MOBILE TEST%")
    .not("name", "ilike", "%CODEX%");
  const submissionRows = (rawSubmissions ?? []).filter(item => !isTestContributor(item.name));
  const submissionIds = submissionRows.map(item => item.id);
  const submissionsById = new Map(submissionRows.map(item => [item.id, item]));

  const baseColumns = "id,submission_id,original_name,mime_type,caption,chapter_number,poster_path,display_order";
  let mediaRows: MediaRow[] = [];
  if (submissionIds.length) {
    const enriched = await supabase
      .from("media_assets")
      .select(`${baseColumns},inferred_year_start,inferred_year_end,date_inference_source`)
      .in("submission_id", submissionIds)
      .neq("review_status", "excluded")
      .order("display_order");
    if (enriched.error && (enriched.error.code === "42703" || /inferred_year|date_inference/i.test(enriched.error.message))) {
      const fallback = await supabase
        .from("media_assets")
        .select(baseColumns)
        .in("submission_id", submissionIds)
        .neq("review_status", "excluded")
        .order("display_order");
      mediaRows = (fallback.data ?? []) as unknown as MediaRow[];
    } else {
      mediaRows = (enriched.data ?? []) as unknown as MediaRow[];
    }
  }

  return (
    <main className="revealPage">
      <RevealExperience
        chapters={STORY_CHAPTERS.map((title, index) => {
          const approved = approvedByNumber.get(index + 1);
          return {
            number: index + 1,
            title: approved?.title || title,
            text: approved?.approved_text || ""
          };
        })}
        media={mediaRows.map(item => {
          const submission = submissionsById.get(item.submission_id);
          const prompt = submission?.prompt?.toUpperCase();
          const suppliedRange = contributorYearRange(submission?.approximate_year);
          const inferredStart = item.inferred_year_start ?? null;
          const inferredEnd = item.inferred_year_end ?? inferredStart;
          const yearSource = suppliedRange
            ? "contributor" as const
            : item.date_inference_source === "exif"
              ? "exif" as const
              : item.date_inference_source === "visual-decade"
                ? "visual-decade" as const
                : null;
          return {
            id: item.id,
            originalName: item.original_name,
            mimeType: item.mime_type,
            caption: item.caption ?? "",
            chapterNumber: item.chapter_number,
            poster: Boolean(item.poster_path),
            contributorName: submission?.name ?? "Someone who loves Sandi",
            relationship: submission?.relationship ?? "",
            collection: prompt === "VOICE_WALL"
              ? "voice" as const
              : prompt === "BIRTHDAY_MESSAGE"
                ? "birthday" as const
                : "archive" as const,
            yearStart: suppliedRange?.start ?? inferredStart,
            yearEnd: suppliedRange?.end ?? inferredEnd,
            yearSource
          };
        })}
      />
    </main>
  );
}
