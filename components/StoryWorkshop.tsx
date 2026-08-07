"use client";

import { useEffect, useState } from "react";

type Chapter = {
  id: string;
  chapter_number: number;
  title: string;
  draft_text: string;
  approved_text: string;
  status: "empty" | "draft" | "approved";
  updated_at: string;
};

export function StoryWorkshop() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/studio/story", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      setError(body.detail || body.error || "The story workshop could not be loaded.");
      return;
    }
    setChapters(body.chapters);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function draftAll() {
    setWorking(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/studio/story/draft", { method: "POST" });
    const body = await response.json();
    if (!response.ok) setError(body.error || "The draft could not be created.");
    else {
      setNotice(`Drafted ${body.chapterCount} chapters from ${body.assignmentCount} source assignments. Nothing has been approved.`);
      await load();
    }
    setWorking(false);
  }

  async function save(chapter: Chapter, action: "save" | "approve") {
    setWorking(true);
    setError("");
    const response = await fetch("/api/studio/story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapterNumber: chapter.chapter_number,
        draftText: chapter.draft_text,
        approvedText: action === "approve" ? chapter.draft_text : undefined,
        action
      })
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "The chapter could not be saved.");
    else {
      setNotice(action === "approve" ? `Chapter ${chapter.chapter_number} approved.` : `Chapter ${chapter.chapter_number} saved as a draft.`);
      await load();
    }
    setWorking(false);
  }

  return (
    <section className="storyWorkshop">
      <header>
        <div>
          <span className="eyebrow">THE STORY ENGINE</span>
          <h2>Drafted by the system. Decided by you.</h2>
          <p>Claude may organize and draft from submitted facts. Every chapter remains private until you edit and approve it.</p>
        </div>
        <button className="primary" type="button" disabled={working} onClick={draftAll}>
          {working ? "Working…" : chapters.some(chapter => chapter.status !== "empty") ? "Regenerate all drafts" : "Draft all eight chapters"}
        </button>
      </header>
      {error && <p className="studioError" role="alert">{error}</p>}
      {notice && <p className="studioNotice" role="status">{notice}</p>}
      <div className="chapterEditors">
        {chapters.map((chapter, index) => (
          <article key={chapter.id}>
            <header>
              <span>CHAPTER {String(chapter.chapter_number).padStart(2, "0")}</span>
              <strong>{chapter.status}</strong>
            </header>
            <h3>{chapter.title}</h3>
            <textarea
              rows={16}
              value={chapter.draft_text}
              placeholder="No draft yet."
              onChange={event => setChapters(current => current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, draft_text: event.target.value } : item
              ))}
            />
            <div>
              <button className="secondary compact" type="button" disabled={working} onClick={() => save(chapter, "save")}>Save draft</button>
              <button className="include" type="button" disabled={working || !chapter.draft_text.trim()} onClick={() => save(chapter, "approve")}>Approve chapter</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
