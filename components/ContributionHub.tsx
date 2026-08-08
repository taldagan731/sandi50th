"use client";

import { useRef, useState } from "react";
import { MemoryContributionForm } from "@/components/MemoryContributionForm";
import { RecordingContributionForm } from "@/components/RecordingContributionForm";
import { NameChorusRecorder } from "@/components/NameChorusRecorder";

type Path = "memory" | "voice" | "birthday" | "name";

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
      <nav className="contributionPathNav" aria-label="Ways to contribute">
        <button type="button" aria-pressed={path === "memory"} aria-controls="active-contribution-form" onClick={() => choosePath("memory")}>
          <span>01</span><strong>Share a memory or album</strong><small>Text, photographs, video, ZIP, or a whole folder</small>
        </button>
        <button type="button" aria-pressed={path === "voice"} aria-controls="active-contribution-form" onClick={() => choosePath("voice")}>
          <span>02</span><strong>Record a voice memory</strong><small>Tell a story in thirty to sixty seconds</small>
        </button>
        <button type="button" aria-pressed={path === "birthday"} aria-controls="active-contribution-form" onClick={() => choosePath("birthday")}>
          <span>03</span><strong>Record a birthday message</strong><small>Camera or voice only - speak directly to Sandi</small>
        </button>
        <button type="button" aria-pressed={path === "name"} aria-controls="active-contribution-form" onClick={() => choosePath("name")}>
          <span>04</span><strong>Say only your name</strong><small>Already contributed? Add three seconds of your voice</small>
        </button>
      </nav>

      <div className="contributionPath" id="active-contribution-form" ref={contributionPath} tabIndex={-1}>
        {path === "memory" && <MemoryContributionForm initialChapter={initialChapter} />}
        {path === "voice" && <RecordingContributionForm kind="voice" />}
        {path === "birthday" && <RecordingContributionForm kind="birthday" />}
        {path === "name" && <NameChorusRecorder standalone />}
      </div>
    </div>
  );
}
