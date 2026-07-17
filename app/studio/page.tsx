import Link from "next/link";
import { Navigation } from "@/components/Navigation";

export default function StudioPage() {
  return (
    <main>
      <Navigation />
      <section className="pageTop studioComingSoon">
        <div className="shell studioComingSoonInner">
          <span className="eyebrow">PRIVATE STORY STUDIO</span>
          <h1>The editing room is being prepared.</h1>
          <p>
            This private area will allow Tal and Beth to review, label, and organize
            contributions. Contributor uploads can be activated first; reviewer login
            is the next release.
          </p>
          <Link className="primary" href="/">Return to the invitation</Link>
        </div>
      </section>
    </main>
  );
}
