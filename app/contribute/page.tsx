import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { ContributionHub } from "@/components/ContributionHub";
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
  searchParams: Promise<{ chapter?: string }>;
}) {
  const { chapter } = await searchParams;
  const initialChapter = chapter ? chapterDefaults[chapter] : undefined;

  return (
    <main>
      <Navigation />
      <section className="contributeHero pageTop">
        <div className="contributeGlow contributeGlowOne" />
        <div className="contributeGlow contributeGlowTwo" />
        <div className="shell contributeIntro">
          <span className="eyebrow">A PRIVATE INVITATION</span>
          <h1>Help us preserve a memory that deserves to live forever.</h1>
          <p>
            Send a story, drop an entire album, or record your voice or birthday message. Everything will be woven into a private film for August 11.
          </p>
          <div className="submissionDeadline"><span>✦</span><div><strong>Please contribute by August 10, 2026</strong><small>You may return and submit more than once.</small></div></div>
        </div>
      </section>

      <section className="contributionSection">
        <div className="shell"><ContributionHub initialChapter={initialChapter} /></div>
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
