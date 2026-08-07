import type { Metadata } from "next";
import Link from "next/link";
import { RevealExperience } from "@/components/RevealExperience";
import { requireStudioOwner } from "@/lib/studio/auth";

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
    .select("id")
    .eq("project_id", owner.project.id);
  const submissionIds = submissionRows?.map(item => item.id) ?? [];

  const { data: mediaRows } = submissionIds.length
    ? await owner.supabase
        .from("media_assets")
        .select("id,original_name,mime_type,caption,chapter_number,poster_path,display_order")
        .in("submission_id", submissionIds)
        .eq("review_status", "included")
        .not("chapter_number", "is", null)
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
        media={(mediaRows ?? []).map(item => ({
          id: item.id,
          originalName: item.original_name,
          mimeType: item.mime_type,
          caption: item.caption ?? "",
          chapterNumber: item.chapter_number as number,
          poster: Boolean(item.poster_path)
        }))}
      />
    </main>
  );
}
