"use client";

import { MemoryContributionForm } from "@/components/MemoryContributionForm";
import { NameChorusRecorder } from "@/components/NameChorusRecorder";

type Path = "memory" | "photos" | "voice" | "birthday" | "name";

export function ContributionHub({ initialChapter }: { initialChapter?: string; initialPath?: Path }) {
  return (
    <div className="contributionHub oneStepContribution">
      <header className="contributionChoiceIntro">
        <span className="eyebrow">ONE SIMPLE STEP</span>
        <h2>Add anything you have, then send it.</h2>
        <p>Writing is optional. Photos, a voice recording, or a birthday video can be sent on their own.</p>
        <div className="oneStepPromise" role="list" aria-label="What you can send">
          <span role="listitem">Write</span>
          <span role="listitem">Photos or video</span>
          <span role="listitem">Voice</span>
          <span role="listitem">Birthday message</span>
        </div>
      </header>
      <div className="contributionPath" id="active-contribution-form">
        <MemoryContributionForm initialChapter={initialChapter} />
      </div>
      <details className="nameOnlyShortcut oneStepNameOnly">
        <summary>Already sent something? Add three seconds of your voice saying only your name.</summary>
        <NameChorusRecorder standalone />
      </details>
    </div>
  );
}
