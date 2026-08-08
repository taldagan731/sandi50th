import Image from "next/image";
import Link from "next/link";
import { Countdown } from "@/components/Countdown";

const moments = [
  "New Hyde Park · where the story began",
  "Roslyn · family, books, and lifelong friendship",
  "Boston · English, psychology, and a wider world",
  "England · a semester that opened another chapter",
  "Oracle · leadership, systems, and global impact",
  "Iceland · Spain · France · Italy · Israel",
  "Some families begin with birth. Others begin with choice."
];

export function OpeningExperience() {
  return (
    <section className="opening celebrationHero" aria-labelledby="birthday-hero-title">
      <Image
        className="celebrationHeroImage"
        src="/api/public/hero-photo"
        alt="Sandi Yadegari, celebrated by family and friends for her fiftieth birthday"
        fill
        priority
        sizes="100vw"
      />
      <div className="celebrationHeroScrim" aria-hidden="true" />
      <div className="celebrationGlow celebrationGlowCoral" aria-hidden="true" />
      <div className="celebrationGlow celebrationGlowAmber" aria-hidden="true" />

      <div className="shell celebrationHeroContent">
        <p className="celebrationKicker">A SECRET CELEBRATION · AUGUST 11, 2026</p>
        <div className="celebrationIdentity">
          <span className="celebrationFifty">50</span>
          <h1 id="birthday-hero-title">Sandi Yadegari</h1>
          <span>Still Becoming</span>
        </div>
        <p className="celebrationLead">
          <strong>The way we see you.</strong> Curious, funny, generous, formidable—and only getting started.
        </p>
        <div className="actions celebrationActions">
          <Link className="primary" href="/contribute">Add to the celebration</Link>
          <a className="secondary" href="#invitation">See what everyone is making</a>
        </div>
        <div className="celebrationDeadline">
          <div>
            <strong>Please contribute by August 10.</strong>
            <span>Photographs, films, stories, voices, and birthday messages are all welcome.</span>
          </div>
          <Countdown />
        </div>
      </div>

      <div className="momentRibbon" aria-hidden="true">
        <div>
          {[...moments, ...moments].map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
        </div>
      </div>
    </section>
  );
}
