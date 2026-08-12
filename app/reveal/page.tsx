import type { Metadata } from "next";
import Link from "next/link";
import { RevealExperience } from "@/components/RevealExperience";
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

export default async function RevealPage() {
  const owner = await requireStudioOwner();
  if (!owner) {
    return (
      <main className="revealLocked">
        <section>
          <span className="eyebrow">PRIVATE REVEAL</span>
          <h1>This story is not public.</h1>
          <p>Sign in through the private Story Studio before opening the film and archive.</p>
          <Link className="primary" href="/studio">Open Story Studio</Link>
        </section>
      </main>
    );
  }

  const { data: chapterRows } = await owner.supabase
    .from("story_chapters")
    .select("chapter_number,title,approved_text,status")
    .eq("project_id", owner.project.id)
    .eq("status", "approved")
    .order("chapter_number");

  const { data: submissionRows } = await owner.supabase
    .from("submissions")
    .select("id,name,relationship,prompt,approximate_year")
    .eq("project_id", owner.project.id);
  const submissionIds = submissionRows?.map(item => item.id) ?? [];
  const submissionsById = new Map((submissionRows ?? []).map(item => [item.id, item]));

  const baseColumns = "id,submission_id,original_name,mime_type,caption,chapter_number,poster_path,display_order";
  let mediaRows: MediaRow[] = [];
  if (submissionIds.length) {
    const enriched = await owner.supabase
      .from("media_assets")
      .select(`${baseColumns},inferred_year_start,inferred_year_end,date_inference_source`)
      .in("submission_id", submissionIds)
      .eq("review_status", "included")
      .order("display_order");
    if (enriched.error && (enriched.error.code === "42703" || /inferred_year|date_inference/i.test(enriched.error.message))) {
      const fallback = await owner.supabase
        .from("media_assets")
        .select(baseColumns)
        .in("submission_id", submissionIds)
        .eq("review_status", "included")
        .order("display_order");
      mediaRows = (fallback.data ?? []) as unknown as MediaRow[];
    } else {
      mediaRows = (enriched.data ?? []) as unknown as MediaRow[];
    }
  }

  return (
    <main className="revealPage">
      <RevealExperience
        chapters={(chapterRows ?? []).map(item => ({
          number: item.chapter_number,
          title: item.title,
          text: item.approved_text
        }))}
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
