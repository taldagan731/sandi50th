"use client";

import { useState } from "react";
import { MemoryContributionForm } from "@/components/MemoryContributionForm";
import { RecordingContributionForm } from "@/components/RecordingContributionForm";

type Path = "memory" | "voice" | "birthday";

export function ContributionHub({ initialChapter }: { initialChapter?: string }) {
  const [path, setPath] = useState<Path>("memory");

  return (
    <div className="contributionHub">
      <nav className="contributionPathNav" aria-label="Ways to contribute">
        <button type="button" aria-pressed={path === "memory"} onClick={() => setPath("memory")}>
          <span>01</span>
          <strong>Share a memory or album</strong>
          <small>Text, photographs, video, ZIP, or a whole folder</small>
        </button>
        <button type="button" aria-pressed={path === "voice"} onClick={() => setPath("voice")}>
          <span>02</span>
          <strong>Record a voice memory</strong>
          <small>Tell a story in thirty to sixty seconds</small>
        </button>
        <button type="button" aria-pressed={path === "birthday"} onClick={() => setPath("birthday")}>
          <span>03</span>
          <strong>Record a birthday message</strong>
          <small>Camera or voice only — speak directly to Sandi</small>
        </button>
      </nav>

      <div className="contributionPath" id={"contribution-" + path}>
        {path === "memory" && <MemoryContributionForm initialChapter={initialChapter} />}
        {path === "voice" && <RecordingContributionForm kind="voice" />}
        {path === "birthday" && <RecordingContributionForm kind="birthday" />}
      </div>
    </div>
  );
}
