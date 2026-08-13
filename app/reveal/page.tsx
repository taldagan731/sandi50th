import type { Metadata } from "next";
import Link from "next/link";
import { RevealExperience } from "@/components/RevealExperience";
import { STORY_CHAPTERS, chapterNumberFromContributor, isTestContributor } from "@/lib/chapters";
import { FAMILY_QA_SEED, decodeFamilyQaMetadata } from "@/lib/family-qa";
import { applyFamilyQaSourceCorrections } from "@/lib/family-qa-source-corrections";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudioOwner } from "@/lib/studio/auth";
import { hasRevealPreviewAccess } from "@/lib/reveal-preview";
import { getRevealShareAccess } from "@/lib/reveal-share";
import { getRevealProject, isRevealPublic } from "@/lib/reveal-visibility";
import "./reveal-recordings.css";
import "./reveal-archive.css";
import "./name-chorus.css";
import "./sandi-signature.css";
import "./sandi-signature-trigger.css";
import "./chapter-nine.css";
import "./reveal-family-qa.css";
import "./reveal-contribute-cta.css";
import "./mobile-reveal.css";
import "./text-scroll.css";
import "./birth-week-experience.css";
import "./birth-week-luxury-pass.css";
import "./birth-week-print-brand-pass.css";
import "./birth-week-walkman-pass.css";
import "./birth-week-teal-tv-pass.css";
import "./birth-week-tps-l2-pass.css";
import "./birth-week-real-tv-pass.css";
import "./birth-week-photoreal-pass.css";
import "./birth-week-photographic-tv.css";
import "./birth-week-ge-tv.css";
import "./birth-week-embed-safety.css";
import "./birth-week-cassette-mechanism.css";
import "./birth-week-matched-walkman.css";

import "./photo-stories.css";
import "./face-tags.css";
import "./chapter-navigator.css";
import "./tal-dedication.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const publicReveal = await isRevealPublic();
  return {
    title: publicReveal ? "Still Becoming \u2014 The Story of Sandi" : "Still Becoming \u2014 Private Reveal",
    robots: publicReveal
      ? { index: true, follow: true }
      : { index: false, follow: false, noarchive: true, nosnippet: true }
  };
}

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
  canonical_media_id?: string | null;
};

const SPECIAL_TEXT_PROMPTS = new Set(["VOICE_WALL", "BIRTHDAY_MESSAGE", "NAME_CHORUS", "OWNER_ARCHIVE"]);
const SYSTEM_PLACEHOLDER_TEXT = new Set([
  "a birthday message recorded for sandi.",
  "a voice memory recorded for sandi.",
  "voice memory recorded for sandi. please edit this sentence if the live transcript did not appear.",
  "name chorus recording.",
  "photographs or video shared for sandi's birthday story."
]);

function meaningfulContributionText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text && !SYSTEM_PLACEHOLDER_TEXT.has(text.toLowerCase()) ? text : "";
}

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

export default async function RevealPage({ searchParams }: { searchParams?: Promise<{ review?: string }> }) {
  const params = await searchParams;
  const owner = await requireStudioOwner();
  const ownerPreview = !owner && await hasRevealPreviewAccess();
  const guestShare = !owner && !ownerPreview ? await getRevealShareAccess() : null;
  const includeTests = Boolean(owner && params?.review === "all");
  const supabase = owner?.supabase ?? createAdminClient();
  let projectId = owner?.project.id ?? null;

  if (!owner) {
    const publicProject = await getRevealProject();
    const guestCanView = Boolean(guestShare && publicProject && guestShare.projectId === publicProject.id);
    if (!publicProject || (!ownerPreview && !guestCanView && !publicProject.revealPublic)) return <LockedReveal />;
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

  let submissionQuery = supabase
    .from("submissions")
    .select("id,name,relationship,prompt,first_memory,story,approximate_year,location,life_chapter,status,review_status,reviewer_notes")
    .eq("project_id", projectId);
  if (!includeTests) {
    submissionQuery = submissionQuery
      .neq("review_status", "excluded")
      .not("name", "ilike", "%AUTOMATED TEST%")
      .not("name", "ilike", "%MOBILE TEST%")
      .not("name", "ilike", "%CODEX%");
  }
  const { data: rawSubmissions } = await submissionQuery;
  const submissionRows = includeTests
    ? (rawSubmissions ?? [])
    : (rawSubmissions ?? []).filter(item => !isTestContributor(item.name));
  const submissionIds = submissionRows.map(item => item.id);
  const submissionsById = new Map(submissionRows.map(item => [item.id, item]));

  const legacyBaseColumns = "id,submission_id,original_name,mime_type,caption,chapter_number,poster_path,display_order";
  const baseColumns = `${legacyBaseColumns},canonical_media_id`;
  let mediaRows: MediaRow[] = [];
  if (submissionIds.length) {
    let enrichedQuery = supabase
      .from("media_assets")
      .select(`${baseColumns},inferred_year_start,inferred_year_end,date_inference_source`)
      .in("submission_id", submissionIds);
    if (!includeTests) enrichedQuery = enrichedQuery.neq("review_status", "excluded");
    const enriched = await enrichedQuery.order("display_order");
    if (enriched.error && (enriched.error.code === "42703" || /inferred_year|date_inference|canonical_media_id/i.test(enriched.error.message))) {
      let fallbackQuery = supabase
        .from("media_assets")
        .select(legacyBaseColumns)
        .in("submission_id", submissionIds);
      if (!includeTests) fallbackQuery = fallbackQuery.neq("review_status", "excluded");
      const fallback = await fallbackQuery.order("display_order");
      mediaRows = (fallback.data ?? []) as unknown as MediaRow[];
    } else {
      mediaRows = (enriched.data ?? []) as unknown as MediaRow[];
    }
  }

  // Canonical relationships help review, but never remove a contribution from the reveal.
  const presentationMediaRows = mediaRows;

  const writtenMemories = submissionRows.flatMap(item => {
    if (item.status === "family_qa") return [];
    const firstMemory = meaningfulContributionText(item.first_memory);
    const story = meaningfulContributionText(item.story);
    if (!firstMemory && !story) return [];
    // Every included written contribution must be visible. Unknown labels are
    // placed in Still Becoming instead of disappearing from the reveal.
    const chapterNumber = chapterNumberFromContributor(item.life_chapter) ?? 8;
    return [{
      id: item.id,
      chapterNumber,
      contributorName: item.name || "Someone who loves Sandi",
      relationship: item.relationship || "",
      firstMemory,
      story,
      when: item.approximate_year || "",
      place: item.location || ""
    }];
  });

  const storedFamilyAnswers = submissionRows.flatMap(item => {
    if (item.status !== "family_qa") return [];
    const metadata = decodeFamilyQaMetadata(item.reviewer_notes);
    if (!metadata) return [];
    const chapterMatch = item.life_chapter?.match(/\b([1-8])\b/);
    return [applyFamilyQaSourceCorrections({
      id: item.id,
      sourceId: metadata.sourceId,
      contributorName: item.name,
      relationship: item.relationship || "Family",
      question: item.prompt || "",
      answer: item.first_memory || "",
      chapterNumber: chapterMatch ? Number(chapterMatch[1]) : 8,
      when: item.approximate_year || "",
      place: item.location || "",
      chorusKeys: metadata.chorusKeys,
      photoAssetIds: metadata.photoAssetIds,
      showInChapter: metadata.showInChapter,
      editorialNote: metadata.editorialNote
    })];
  });
  const familyAnswers = storedFamilyAnswers.length
    ? storedFamilyAnswers
    : FAMILY_QA_SEED.map(item => ({
        id: item.id,
        contributorName: item.contributorName,
        relationship: item.relationship,
        question: item.question,
        answer: item.answer,
        chapterNumber: item.chapterNumber,
        when: item.when,
        place: item.place,
        chorusKeys: item.chorusKeys,
        photoAssetIds: item.photoAssetIds,
        showInChapter: item.showInChapter
      }));

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
        ownerRehearsal={Boolean(owner || ownerPreview)}
        familyAnswers={familyAnswers}
        writtenMemories={writtenMemories}
        media={presentationMediaRows.map(item => {
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
          // Every contributed audio file is a voice recording unless its prompt
          // explicitly places it in the birthday reel or name chorus.
          const looksLikeVoiceRecording = item.mime_type.startsWith("audio/");
          return {
            id: item.id,
            originalName: item.original_name,
            // A H.264/AAC QuickTime file is an ISO-BMFF stream that browsers can
            // play reliably when advertised as MP4. The original remains intact.
            mimeType: item.mime_type === "video/quicktime"
              ? "video/mp4"
              : item.mime_type === "audio/x-m4a"
                ? "audio/mp4"
                : item.mime_type,
            caption: item.caption ?? "",
            chapterNumber: item.chapter_number,
            poster: Boolean(item.poster_path),
            contributorName: submission?.name ?? "Someone who loves Sandi",
            relationship: submission?.relationship ?? "",
            collection: prompt === "NAME_CHORUS" || item.original_name.startsWith("name-chorus-")
              ? "name" as const
              : prompt === "BIRTHDAY_MESSAGE"
                ? "birthday" as const
                : prompt === "VOICE_WALL" || looksLikeVoiceRecording
                  ? "voice" as const
                  : "archive" as const,
            yearStart: suppliedRange?.start ?? inferredStart,
            yearEnd: suppliedRange?.end ?? inferredEnd,
            yearSource,
            displayOrder: item.display_order,
            testRecord: isTestContributor(submission?.name)
          };
        })}
      />
    </main>
  );
}



