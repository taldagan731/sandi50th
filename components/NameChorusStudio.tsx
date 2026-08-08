"use client";

import { useMemo, useState } from "react";

type ChorusMedia = {
  id: string;
  original_name: string;
  mime_type: string;
  review_status: "pending" | "included" | "excluded";
  display_order: number;
};

type ChorusSubmission = {
  id: string;
  name: string;
  relationship: string;
  prompt: string;
  media: ChorusMedia[];
};

export function NameChorusStudio({ submissions, onSaved }: { submissions: ChorusSubmission[]; onSaved: () => Promise<void> }) {
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const people = useMemo(() => {
    const grouped = new Map<string, { name: string; relationship: string; recordings: ChorusMedia[] }>();
    for (const submission of submissions) {
      if (/owner archive/i.test(submission.name)) continue;
      const key = submission.name.trim().toLocaleLowerCase();
      if (!key) continue;
      const current = grouped.get(key) ?? { name: submission.name, relationship: submission.relationship, recordings: [] };
      current.recordings.push(...submission.media.filter(item => item.mime_type.startsWith("audio/") && item.original_name.startsWith("name-chorus-")));
      if (!current.relationship && submission.relationship) current.relationship = submission.relationship;
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => {
      if (Boolean(a.recordings.length) !== Boolean(b.recordings.length)) return a.recordings.length ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [submissions]);
  const recorded = people.filter(item => item.recordings.length).length;

  async function save(item: ChorusMedia, reviewStatus: "included" | "excluded", displayOrder = item.display_order) {
    setWorkingId(item.id);
    setError("");
    const response = await fetch("/api/studio/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaId: item.id,
        reviewStatus,
        chapterNumber: null,
        caption: "Name chorus",
        notes: "",
        displayOrder
      })
    });
    const result = await response.json();
    if (!response.ok) setError(result.error || "The chorus choice could not be saved.");
    else await onSaved();
    setWorkingId("");
  }

  return (
    <section className="nameChorusStudio" aria-labelledby="name-chorus-studio-title">
      <header>
        <div>
          <span className="eyebrow">THE ROOM OF VOICES</span>
          <h2 id="name-chorus-studio-title">Who has said their name?</h2>
          <p>Recorded names play under the birthday song. Everyone else remains visible here so you know whom to ask.</p>
        </div>
        <strong>{recorded} of {people.length}</strong>
      </header>
      {error && <p className="studioError" role="alert">{error}</p>}
      <div className="nameChorusRoster">
        {people.map(person => (
          <article key={person.name.toLocaleLowerCase()} className={person.recordings.length ? "has-name" : "needs-name"}>
            <div>
              <h3>{person.name}</h3>
              <p>{person.relationship || "Someone who loves Sandi"}</p>
            </div>
            {person.recordings.length ? person.recordings.map(recording => (
              <div className="nameChorusRecording" key={recording.id}>
                <audio controls preload="metadata"><source src={`/api/studio/media/${recording.id}`} type={recording.mime_type} /></audio>
                <div>
                  <button type="button" disabled={workingId === recording.id} onClick={() => save(recording, "included", 1)}>First voice</button>
                  <button type="button" disabled={workingId === recording.id} onClick={() => save(recording, "included", 0)}>Shuffle</button>
                  <button type="button" disabled={workingId === recording.id} onClick={() => save(recording, "included", 9999)}>Last voice</button>
                  {recording.review_status === "excluded"
                    ? <button type="button" disabled={workingId === recording.id} onClick={() => save(recording, "included")}>Restore</button>
                    : <button className="exclude" type="button" disabled={workingId === recording.id} onClick={() => save(recording, "excluded")}>Exclude</button>}
                </div>
              </div>
            )) : <span className="nameChorusMissing">Not recorded yet</span>}
          </article>
        ))}
      </div>
    </section>
  );
}
