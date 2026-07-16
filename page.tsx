import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { MemoryContributionForm } from "@/components/MemoryContributionForm";

export default function ContributePage() {
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
            Send a story, a photograph, an old home movie, a voice, or a piece of Sandi’s history. Everything will be woven into a private film for August 11.
          </p>
          <div className="submissionDeadline"><span>✦</span><div><strong>Please contribute by August 7, 2026</strong><small>You may return and submit more than once.</small></div></div>
        </div>
      </section>

      <section className="contributionSection">
        <div className="shell"><MemoryContributionForm /></div>
      </section>

      <section className="contributionFooter">
        <div className="shell contributionFooterInner">
          <p>One photograph can reopen an entire chapter.</p>
          <Link href="/">Return to the invitation</Link>
        </div>
      </section>
    </main>
  );
}
