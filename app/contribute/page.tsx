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
  searchParams: Promise<{ chapter?: string; mode?: string }>;
}) {
  const { chapter, mode } = await searchParams;
  const initialChapter = chapter ? chapterDefaults[chapter] : undefined;
  const initialPath = mode === "birthday" ? "birthday" : mode === "voice" ? "voice" : mode === "photos" ? "photos" : mode === "memory" ? "memory" : mode === "name" ? "name" : undefined;
  return (
    <main>
      <Navigation />
      <section className="contributionSection contributionFirstScreen">
        <p className="srOnly">Please contribute by August 10, 2026; contributions remain welcome including after the reveal is live.</p>
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
