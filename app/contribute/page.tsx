import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { ContributionHub } from "@/components/ContributionHub";
import "./contribution-release.css";

export default function ContributePage() {
  return (
    <main>
      <Navigation />
      <section className="contributeHero pageTop">
        <div className="contributeGlow contributeGlowOne" />
        <div className="contributeGlow contributeGlowTwo" />
        <div className="shell contributeIntro">
          <span className="eyebrow">THE ARCHIVE REMAINS OPEN</span>
          <h1>Send the memory, photograph, or voice note that still belongs with her story.</h1>
          <p>
            The birthday reveal has happened, but this archive is still alive. Add a written memory, an album, a voice note, or a birthday message whenever it is ready.
          </p>
          <div className="submissionDeadline"><span>*</span><div><strong>Contributions are still being added to the archive</strong><small>You can return and submit more than once.</small></div></div>
        </div>
      </section>

      <section className="contributionSection">
        <div className="shell"><ContributionHub /></div>
      </section>

      <section className="contributionFooter">
        <div className="shell contributionFooterInner">
          <p>One photograph or one familiar voice can still reopen an entire chapter.</p>
          <div className="actions">
            <Link href="/">Return to the invitation</Link>
            <Link href="/chapter-nine">Enter Chapter Nine</Link>
          </div>
        </div>
      </section>
    </main>
  );
}