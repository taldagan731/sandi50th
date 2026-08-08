"use client";

import { FormEvent, useEffect, useState } from "react";

type Answer = {
  id: string;
  sourceId: string;
  contributorName: string;
  relationship: string;
  question: string;
  answer: string;
  chapterNumber: number;
  when: string;
  place: string;
  chorusKeys: string[];
  photoAssetIds: string[];
  photoRefs: string[];
  showInChapter: boolean;
  editorialNote: string;
  visible: boolean;
  createdAt: string;
};

type Chorus = { key: string; question: string };
type Pending = { contributorName: string; relationship: string; note: string };
type MediaOption = { id: string; originalName: string; mimeType: string; contributorName: string };

const bulkTemplate = `---
CONTRIBUTOR:
RELATIONSHIP:
QUESTION:
ANSWER:

WHEN:
CHAPTER: AUTO
CHORUS:
PLACE:
PHOTOS:
EDITOR NOTE:
---`;

export function FamilyQaStudio({ media }: { media: MediaOption[] }) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [choruses, setChoruses] = useState<Chorus[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [suppliedCount, setSuppliedCount] = useState(0);
  const [bulkText, setBulkText] = useState("");
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/studio/family-qa", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Family Q&A could not be loaded.");
      return;
    }
    setAnswers(body.answers);
    setChoruses(body.choruses);
    setPending(body.pending);
    setSuppliedCount(body.suppliedCount);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function seedSupplied() {
    setWorking("seed");
    setNotice("");
    setError("");
    const response = await fetch("/api/studio/family-qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed" })
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "The supplied Q&A could not be added.");
    else {
      setAnswers(body.answers);
      setNotice(body.added
        ? `Added ${body.added} answered family prompts. Existing seed records were left unchanged.`
        : "The supplied family Q&A is already present; nothing was duplicated.");
    }
    setWorking("");
  }

  async function importBulk(event: FormEvent) {
    event.preventDefault();
    if (!bulkText.trim()) return;
    setWorking("bulk");
    setNotice("");
    setError("");
    const response = await fetch("/api/studio/family-qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk", text: bulkText })
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "The labeled Q&A could not be imported.");
    else {
      setAnswers(body.answers);
      setBulkText("");
      setNotice(`Added ${body.added} family answer${body.added === 1 ? "" : "s"}.`);
    }
    setWorking("");
  }

  function change(id: string, patch: Partial<Answer>) {
    setAnswers(current => current.map(answer => answer.id === id ? { ...answer, ...patch } : answer));
  }

  async function save(answer: Answer) {
    setWorking(answer.id);
    setNotice("");
    setError("");
    const response = await fetch("/api/studio/family-qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", answer })
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "The answer could not be saved.");
    else {
      setAnswers(body.answers);
      setNotice(`Saved ${answer.contributorName}’s answer.`);
    }
    setWorking("");
  }

  const visibleCount = answers.filter(answer => answer.visible && answer.showInChapter).length;
  const chorusCount = answers.filter(answer => answer.visible && answer.chorusKeys.length).length;
  const photos = media.filter(item => item.mimeType.startsWith("image/"));

  return (
    <section className="familyQaStudio" aria-labelledby="family-qa-title">
      <header>
        <div>
          <span className="eyebrow">FAMILY Q&A</span>
          <h2 id="family-qa-title">The voices that seed the chapters.</h2>
          <p>Each answer remains attributable, may appear in its chronological chapter and in a chorus, and can be paired with an existing photograph. Hiding is the exception; visible is the default.</p>
        </div>
        <dl>
          <div><dt>Stored</dt><dd>{answers.length}</dd></div>
          <div><dt>In chapters</dt><dd>{visibleCount}</dd></div>
          <div><dt>In choruses</dt><dd>{chorusCount}</dd></div>
        </dl>
      </header>

      {!answers.length && (
        <div className="familyQaSeed">
          <div>
            <strong>{suppliedCount} answered prompts are ready to add.</strong>
            <p>The email headers, addresses, medical signature, and unanswered child questionnaires are not imported as story content.</p>
          </div>
          <button className="primary" type="button" disabled={working === "seed"} onClick={seedSupplied}>
            {working === "seed" ? "Adding family voices…" : "Add the supplied family Q&A"}
          </button>
        </div>
      )}

      {answers.length > 0 && (
        <button className="secondary compact" type="button" disabled={working === "seed"} onClick={seedSupplied}>
          Check supplied seed for missing answers
        </button>
      )}

      {pending.length > 0 && (
        <aside className="familyQaPending">
          <strong>Still waiting for answers</strong>
          {pending.map(item => (
            <p key={item.contributorName}><b>{item.contributorName}</b> · {item.relationship}<br />{item.note}</p>
          ))}
        </aside>
      )}

      <details className="familyQaBulk">
        <summary>Add more answers by pasting labeled blocks</summary>
        <form onSubmit={importBulk}>
          <p>One block per answer. Only contributor, relationship, question, and answer are required. Write a chapter number from 1–8; AUTO currently places the item in Chapter 8 for you to correct.</p>
          <textarea
            rows={16}
            value={bulkText}
            onChange={event => setBulkText(event.target.value)}
            placeholder={bulkTemplate}
          />
          <div>
            <button className="secondary" type="button" onClick={() => setBulkText(bulkTemplate)}>Insert blank template</button>
            <button className="primary" type="submit" disabled={working === "bulk" || !bulkText.trim()}>
              {working === "bulk" ? "Importing…" : "Import Q&A"}
            </button>
          </div>
        </form>
      </details>

      {error && <p className="studioError" role="alert">{error}</p>}
      {notice && <p className="studioNotice" role="status">{notice}</p>}

      <div className="familyQaAnswers">
        {answers.map(answer => (
          <article key={answer.id} className={answer.visible ? "familyQaEditor" : "familyQaEditor isHidden"}>
            <header>
              <div>
                <span>{answer.relationship}</span>
                <strong>{answer.contributorName}</strong>
              </div>
              <span>{answer.visible ? "Visible" : "Hidden"}</span>
            </header>

            <div className="familyQaFields">
              <label>Contributor
                <input value={answer.contributorName} onChange={event => change(answer.id, { contributorName: event.target.value })} />
              </label>
              <label>Relationship
                <input value={answer.relationship} onChange={event => change(answer.id, { relationship: event.target.value })} />
              </label>
              <label className="familyQaWide">Question
                <textarea rows={2} value={answer.question} onChange={event => change(answer.id, { question: event.target.value })} />
              </label>
              <label className="familyQaWide">Answer
                <textarea rows={5} value={answer.answer} onChange={event => change(answer.id, { answer: event.target.value })} />
              </label>
              <label>Chapter
                <select value={answer.chapterNumber} onChange={event => change(answer.id, { chapterNumber: Number(event.target.value) })}>
                  {Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={index + 1}>Chapter {index + 1}</option>)}
                </select>
              </label>
              <label>When
                <input value={answer.when} onChange={event => change(answer.id, { when: event.target.value })} placeholder="Optional year, age, or era" />
              </label>
              <label>Place
                <input value={answer.place} onChange={event => change(answer.id, { place: event.target.value })} placeholder="Optional" />
              </label>
              <label>Linked photographs
                <select
                  multiple
                  size={Math.min(6, Math.max(3, photos.length))}
                  value={answer.photoAssetIds}
                  onChange={event => change(answer.id, {
                    photoAssetIds: Array.from(event.currentTarget.selectedOptions, option => option.value)
                  })}
                >
                  {photos.map(item => <option key={item.id} value={item.id}>{item.originalName} · {item.contributorName}</option>)}
                </select>
              </label>
            </div>

            <fieldset className="familyQaChoruses">
              <legend>Use this answer in a chorus</legend>
              {choruses.map(chorus => (
                <label key={chorus.key}>
                  <input
                    type="checkbox"
                    checked={answer.chorusKeys.includes(chorus.key)}
                    onChange={event => change(answer.id, {
                      chorusKeys: event.target.checked
                        ? [...answer.chorusKeys, chorus.key]
                        : answer.chorusKeys.filter(key => key !== chorus.key)
                    })}
                  />
                  {chorus.question}
                </label>
              ))}
            </fieldset>

            <div className="familyQaVisibility">
              <label><input type="checkbox" checked={answer.showInChapter} onChange={event => change(answer.id, { showInChapter: event.target.checked })} /> Woven into its chapter</label>
              <label><input type="checkbox" checked={answer.visible} onChange={event => change(answer.id, { visible: event.target.checked })} /> Visible in the reveal</label>
            </div>

            {answer.photoRefs.length > 0 && <p className="familyQaRefs">Unmatched photograph references: {answer.photoRefs.join(", ")}</p>}
            {answer.editorialNote && <p className="familyQaEditorial"><strong>Editorial note</strong> {answer.editorialNote}</p>}

            <button className="secondary compact" type="button" disabled={working === answer.id} onClick={() => save(answer)}>
              {working === answer.id ? "Saving…" : "Save answer"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
