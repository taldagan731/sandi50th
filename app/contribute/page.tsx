import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { ContributionHub } from "@/components/ContributionHub";
import { isRevealPublic } from "@/lib/reveal-visibility";
import "./contribution-release.css";
import "./name-chorus.css";

const chapterDefaults: Record<string, string> = {
  "1": "Baby and early childhood",
  "2": "Growing up in Roslyn",
  "3": "Boston University",
  "4": "Oracle and career achievements",
  "5": "Family and love",
  "6": "Travel and adventure",
  "7": "Friendship",
  "8": "Sandi today"
};

export default async function ContributePage({
  searchParams
}: {
  searchParams: Promise<{ chapter?: string; mode?: string }>;
}) {
  const { chapter, mode } = await searchParams;
  const initialChapter = chapter ? chapterDefaults[chapter] : undefined;
  const initialPath = mode === "birthday" ? "birthday" : mode === "voice" ? "voice" : mode === "photos" ? "photos" : mode === "name" ? "name" : "memory";
  const revealPublic = await isRevealPublic();

  return (
    <main>
      <Navigation />
      <section className="contributeHero pageTop">
        <div className="contributeGlow contributeGlowOne" />
        <div className="contributeGlow contributeGlowTwo" />
        <div className="shell contributeIntro">
          <span className="eyebrow">{revealPublic ? "THE STORY KEEPS GROWING" : "A PRIVATE INVITATION"}</span>
          <h1>{revealPublic ? "The celebration is live. Your memory can still join it." : "Help us preserve a memory that deserves to live forever."}</h1>
          <p>
            {revealPublic
              ? "Send a story, add photographs or video, or record your voice or birthday message. New contributions remain welcome after the reveal opens."
              : "Send a story, drop an entire album, or record your voice or birthday message. Everything will be woven into the birthday story—and contributions stay open after August 11."}
          </p>
          <div className="submissionDeadline"><span>✦</span><div><strong>{revealPublic ? "Contributions remain open" : "Please contribute by August 10, 2026"}</strong><small>You may return and submit more than once, including after the reveal is live.</small></div></div>
        </div>
      </section>

      <section className="contributionSection">
        <div className="shell"><ContributionHub initialChapter={initialChapter} initialPath={initialPath} /></div>
      </section>

      <section className="contributionFooter">
        <div className="shell contributionFooterInner">
          <p>One photograph—or one familiar voice—can reopen an entire chapter.</p>
          <Link href="/">Return to the invitation</Link>
        </div>
      </section>
    </main>
  );
}
