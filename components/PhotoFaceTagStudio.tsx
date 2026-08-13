"use client";

import { type PointerEvent, useEffect, useRef, useState } from "react";

type Tag = {
  id: string; name: string; x: number; y: number; width: number; height: number;
  status: "confirmed" | "suggested"; source: "manual" | "ai"; confidence: number | null; referenceTagId: string | null;
};

export function PhotoFaceTagStudio({ mediaId, imageSrc, alt }: { mediaId: string; imageSrc: string; alt: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [migrationRequired, setMigrationRequired] = useState(false);

  async function load() {
    const response = await fetch(`/api/studio/photo-face-tags?mediaId=${encodeURIComponent(mediaId)}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error || "Face tags could not be loaded."); return; }
    setTags(Array.isArray(body.tags) ? body.tags : []);
    setPeople(Array.isArray(body.people) ? body.people : []);
    setMigrationRequired(Boolean(body.migrationRequired));
  }

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [mediaId]);

  function markFace(event: PointerEvent<HTMLDivElement>) {
    if (migrationRequired || event.target !== imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const width = .16;
    const height = .2;
    const centerX = (event.clientX - rect.left) / rect.width;
    const centerY = (event.clientY - rect.top) / rect.height;
    setDraft({ x: Math.max(0, Math.min(1 - width, centerX - width / 2)), y: Math.max(0, Math.min(1 - height, centerY - height / 2)), width, height });
    setName("");
  }

  async function send(body: Record<string, unknown>, id = "request") {
    setWorking(id); setError("");
    try {
      const response = await fetch("/api/studio/photo-face-tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "That face tag could not be saved.");
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That face tag could not be saved.");
      return false;
    } finally { setWorking(""); }
  }

  async function saveDraft() {
    if (!draft || !name.trim()) { setError("Enter the person’s name first."); return; }
    const saved = await send({ action: "add", mediaId, personName: name.trim(), ...draft }, "draft");
    if (saved) { setDraft(null); setName(""); }
  }

  const reviewItems = tags.filter(tag => tag.status === "suggested" || (tag.status === "confirmed" && tag.source === "manual" && tag.confidence === null));
  const suggested = tags.filter(tag => tag.status === "suggested");
  return (
    <section className="faceTagStudio" aria-label={`People in ${alt}`}>
      <header><strong>Tag people in this photograph</strong><p>Tap the center of a face, then enter the person’s name. Confirmed names appear over that face on the reveal.</p></header>
      {migrationRequired ? <p className="studioNotice">Run <strong>supabase/photo-face-tags-migration.sql</strong> once to enable face tagging.</p> : (
        <>
          <div className="faceTagCanvas" onPointerUp={markFace}>
            <img ref={imageRef} src={imageSrc} alt={alt} draggable={false} />
            {tags.filter(tag => tag.status === "confirmed").map(tag => <button key={tag.id} type="button" className="faceTagBox isConfirmed" style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%`, width: `${tag.width * 100}%`, height: `${tag.height * 100}%` }} title={`Remove ${tag.name}`} onClick={() => send({ action: "remove", tagId: tag.id }, tag.id)}><span>{tag.name}</span></button>)}
            {suggested.map(tag => <span key={tag.id} className="faceTagBox isSuggested" style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%`, width: `${tag.width * 100}%`, height: `${tag.height * 100}%` }} aria-hidden="true" />)}
            {draft && <span className="faceTagBox isDraft" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.width * 100}%`, height: `${draft.height * 100}%` }} aria-hidden="true" />}
          </div>
          {draft && <div className="faceTagDraft"><label>Who is this?<input autoFocus list={`face-names-${mediaId}`} value={name} onChange={event => setName(event.target.value)} placeholder="Type a name" maxLength={80} /></label><button type="button" disabled={working === "draft"} onClick={saveDraft}>{working === "draft" ? "Saving…" : "Save name"}</button><button type="button" onClick={() => setDraft(null)}>Cancel</button></div>}
          <datalist id={`face-names-${mediaId}`}>{people.map(person => <option key={person} value={person} />)}</datalist>
          {reviewItems.length > 0 && <div className="faceTagQuestions"><strong>Photo tags need your review</strong>{reviewItems.map(tag => { const existingName = tags.find(item => item.id === tag.referenceTagId)?.name || "the existing tag"; return <div key={tag.id}><label>{tag.referenceTagId ? `Change ${existingName} to ${tag.name}?` : tag.status === "confirmed" ? `New public tag: ${tag.name}` : tag.name ? `Is this ${tag.name}?` : "Who is this person?"}<input list={`face-names-${mediaId}`} value={answers[tag.id] ?? tag.name} onChange={event => setAnswers(current => ({ ...current, [tag.id]: event.target.value }))} /></label><button type="button" disabled={working === tag.id} onClick={() => send({ action: "confirm", tagId: tag.id, personName: (answers[tag.id] ?? tag.name).trim() }, tag.id)}>Confirm</button><button type="button" disabled={working === tag.id} onClick={() => send({ action: "reject", tagId: tag.id }, tag.id)}>{tag.status === "confirmed" ? "Remove tag" : tag.referenceTagId ? "Reject change" : "Reject tag"}</button>{tag.confidence != null && <small>{Math.round(tag.confidence * 100)}% AI confidence</small>}</div>})}</div>}
        </>
      )}
      {error && <p className="studioError" role="alert">{error}</p>}
    </section>
  );
}
