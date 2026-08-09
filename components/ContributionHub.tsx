"use client";

import { useRef, useState } from "react";
import { MemoryContributionForm } from "@/components/MemoryContributionForm";
import { RecordingContributionForm } from "@/components/RecordingContributionForm";
import { NameChorusRecorder } from "@/components/NameChorusRecorder";

type Path = "memory" | "photos" | "voice" | "birthday" | "name";

export function ContributionHub({ initialChapter, initialPath = "memory" }: { initialChapter?: string; initialPath?: Path }) {
  const [path, setPath] = useState<Path>(initialPath);
  const contributionPath = useRef<HTMLDivElement>(null);

  function choosePath(nextPath: Path) {
    setPath(nextPath);
    window.setTimeout(() => {
      contributionPath.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      contributionPath.current?.focus({ preventScroll: true });
    }, 0);
  }

  return (
    <div className="contributionHub">
      <header className="contributionChoiceIntro">
        <span className="eyebrow">START HERE</span>
        <h2>What would you like to share?</h2>
        <p>Choose one. You can always come back and send something else.</p>
      </header>
      <nav className="contributionPathNav" aria-label="Ways to contribute">
        <button type="button" aria-pressed={path === "memory"} aria-controls="active-contribution-form" onClick={() => choosePath("memory")}>
          <span>01</span><strong>Write a memory</strong><small>Tell one story in your own words</small>
        </button>
        <button type="button" aria-pressed={path === "photos"} aria-controls="active-contribution-form" onClick={() => choosePath("photos")}>
          <span>02</span><strong>Add photos or video</strong><small>No writing required</small>
        </button>
        <button type="button" aria-pressed={path === "voice"} aria-controls="active-contribution-form" onClick={() => choosePath("voice")}>
          <span>03</span><strong>Record your voice</strong><small>Tell a story in thirty to sixty seconds</small>
        </button>
        <button type="button" aria-pressed={path === "birthday"} aria-controls="active-contribution-form" onClick={() => choosePath("birthday")}>
          <span>04</span><strong>Record a birthday message</strong><small>Video or voice - speak directly to Sandi</small>
        </button>
      </nav>

      <button className="nameOnlyShortcut" type="button" aria-pressed={path === "name"} onClick={() => choosePath("name")}>Already contributed? Add three seconds of your voice saying only your name.</button>

      <div className="contributionPath" id="active-contribution-form" ref={contributionPath} tabIndex={-1}>
        {path === "memory" && <MemoryContributionForm initialChapter={initialChapter} onSkipToPhotos={() => choosePath("photos")} />}
        {path === "photos" && <MemoryContributionForm initialChapter={initialChapter} startWithUpload />}
        {path === "voice" && <RecordingContributionForm kind="voice" />}
        {path === "birthday" && <RecordingContributionForm kind="birthday" />}
        {path === "name" && <NameChorusRecorder standalone />}
      </div>
    </div>
  );
}
