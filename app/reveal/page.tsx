import type { Metadata } from "next";
import Link from "next/link";
import { RevealExperience } from "@/components/RevealExperience";
import { requireStudioOwner } from "@/lib/studio/auth";
import "./reveal-recordings.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Still Becoming — Private Reveal",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true }
};

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
    .select("id,name,relationship,prompt")
    .eq("project_id", owner.project.id);
  const submissionIds = submissionRows?.map(item => item.id) ?? [];
  const submissionsById = new Map((submissionRows ?? []).map(item => [item.id, item]));

  const { data: mediaRows } = submissionIds.length
    ? await owner.supabase
        .from("media_assets")
        .select("id,submission_id,original_name,mime_type,caption,chapter_number,poster_path,display_order")
        .in("submission_id", submissionIds)
        .eq("review_status", "included")
        .order("display_order")
    : { data: [] };

  return (
    <main className="revealPage">
      <RevealExperience
        chapters={(chapterRows ?? []).map(item => ({
          number: item.chapter_number,
          title: item.title,
          text: item.approved_text
        }))}
        media={(mediaRows ?? []).map(item => {
          const submission = submissionsById.get(item.submission_id);
          const prompt = submission?.prompt?.toUpperCase();
          return {
            id: item.id,
            originalName: item.original_name,
            mimeType: item.mime_type,
            caption: item.caption ?? "",
            chapterNumber: item.chapter_number as number | null,
            poster: Boolean(item.poster_path),
            contributorName: submission?.name ?? "Someone who loves Sandi",
            relationship: submission?.relationship ?? "",
            collection: prompt === "VOICE_WALL"
              ? "voice" as const
              : prompt === "BIRTHDAY_MESSAGE"
                ? "birthday" as const
                : "archive" as const
          };
        })}
      />
    </main>
  );
}
