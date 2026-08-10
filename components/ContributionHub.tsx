"use client";

import { useState } from "react";
import { MemoryContributionForm } from "@/components/MemoryContributionForm";
import { RecordingContributionForm } from "@/components/RecordingContributionForm";
import { NameChorusRecorder } from "@/components/NameChorusRecorder";
import { trackContributionStep } from "@/lib/contribution-attempt";

type Path = "memory" | "photos" | "voice" | "birthday" | "name";

const choices: Array<{ path: Exclude<Path, "name">; label: string; detail: string; icon: string }> = [
  { path: "memory", label: "Share a memory", detail: "Write a story or a few sentences", icon: "?" },
  { path: "photos", label: "Send photos", detail: "Choose one photo or a whole album", icon: "?" },
  { path: "voice", label: "Record your voice", detail: "Speak instead of typing", icon: "?" },
  { path: "birthday", label: "Record a birthday video", detail: "Use your phone camera", icon: "?" }
];

export function ContributionHub({ initialChapter, initialPath }: { initialChapter?: string; initialPath?: Path }) {
  const [path, setPath] = useState<Path | null>(initialPath ?? null);

  if (!path) {
    return (
      <section className="simpleChoiceScreen" aria-labelledby="contribution-choice-title">
        <h2 id="contribution-choice-title">What would you like to send?</h2>
        <div className="simpleChoiceGrid">
          {choices.map(choice => (
            <button key={choice.path} type="button" onClick={() => { trackContributionStep(choice.path, 0, "selected"); setPath(choice.path); }}>
              <span aria-hidden="true">{choice.icon}</span>
              <strong>{choice.label}</strong>
              <small>{choice.detail}</small>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="simplePathScreen">
      <button className="simpleBack" type="button" onClick={() => setPath(null)}>? Choose something else</button>
      {path === "memory" && <MemoryContributionForm initialChapter={initialChapter} />}
      {path === "photos" && <MemoryContributionForm initialChapter={initialChapter} startWithUpload />}
      {path === "voice" && <RecordingContributionForm kind="voice" />}
      {path === "birthday" && <RecordingContributionForm kind="birthday" />}
      {path === "name" && <NameChorusRecorder standalone />}
    </div>
  );
}
