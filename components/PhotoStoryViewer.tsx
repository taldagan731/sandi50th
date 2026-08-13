"use client";

import { type FormEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type PhotoStory = {
  id: string;
  authorName: string;
  people: string[];
  memory: string;
  createdAt: string;
};

export function PhotoStoryViewer({ mediaId, src, alt, onClose }: { mediaId: string; src: string; alt: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [stories, setStories] = useState<PhotoStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [peopleText, setPeopleText] = useState("");
  const [memory, setMemory] = useState("");
  const [imageLoading, setImageLoading] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const [faceTagging, setFaceTagging] = useState(false);
  const [faceDraft, setFaceDraft] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [faceName, setFaceName] = useState("");
  const [faceSending, setFaceSending] = useState(false);
  const [faceMessage, setFaceMessage] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setLoading(true);
      fetch(`/api/photo-stories?mediaId=${encodeURIComponent(mediaId)}`, { cache: "no-store" })
        .then(response => response.ok ? response.json() : { stories: [] })
        .then(data => { if (active) setStories(Array.isArray(data.stories) ? data.stories : []); })
        .catch(() => undefined)
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [mediaId]);

  const people = useMemo(() => peopleText.split(",").map(value => value.trim()).filter(Boolean), [peopleText]);
  const fullImageSrc = useMemo(() => {
    const cleanSrc = src.split("?")[0];
    const sizedSrc = cleanSrc.includes("/api/reveal/media/") ? `${cleanSrc}?width=1600` : src;
    return imageAttempt > 0 ? `${sizedSrc}${sizedSrc.includes("?") ? "&" : "?"}retry=${imageAttempt}` : sizedSrc;
  }, [src, imageAttempt]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setImageLoading(true);
      setImageFailed(false);
      setImageAttempt(0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [src]);

  function chooseFace(event: PointerEvent<HTMLImageElement>) {
    if (!faceTagging || zoom !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const width = .16;
    const height = .2;
    const centerX = (event.clientX - rect.left) / rect.width;
    const centerY = (event.clientY - rect.top) / rect.height;
    setFaceDraft({ x: Math.max(0, Math.min(1 - width, centerX - width / 2)), y: Math.max(0, Math.min(1 - height, centerY - height / 2)), width, height });
    setFaceMessage("Face selected. Add the person's name below.");
  }

  async function submitFaceTag() {
    if (!faceDraft || !faceName.trim()) { setFaceMessage("Tap a face and enter the person's name."); return; }
    setFaceSending(true); setFaceMessage("");
    try {
      const response = await fetch("/api/photo-face-tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId, personName: faceName.trim(), authorName: authorName.trim(), ...faceDraft, website: "" }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "That face tag could not be saved.");
      setFaceTagging(false); setFaceDraft(null); setFaceName("");
      setFaceMessage(body.proposedChange ? "Your suggested change was sent to the photo curator. The existing tag stays until it is approved." : "The new tag is visible now and was also sent to the photo curator for review. Thank you.");
    } catch (cause) { setFaceMessage(cause instanceof Error ? cause.message : "That face tag could not be saved."); }
    finally { setFaceSending(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!people.length && !memory.trim()) {
      setMessage("Add at least one person or a memory about this photograph.");
      return;
    }
    setSending(true);
    try {
      const response = await fetch("/api/photo-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, authorName, people, memory, website: "" })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.story) throw new Error(data.error || "That story could not be saved.");
      setStories(current => [...current, data.story]);
      setPeopleText("");
      setMemory("");
      setMessage("Added to this photograph. Thank you.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That story could not be saved. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const storyCopies = stories.length > 2 ? [false, true] : [false];

  const dialog = (
    <div className="photoStoryViewer" role="dialog" aria-modal="true" aria-label="Expanded photograph and shared stories">
      <div className="photoStoryToolbar">
        <span>Look closer · add what you remember</span>
        <div>
          <button type="button" onClick={() => setZoom(value => Math.max(1, value - .5))} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => setZoom(value => Math.min(5, value + .5))} aria-label="Zoom in">+</button>
          <button type="button" className={faceTagging ? "is-active" : ""} aria-pressed={faceTagging} onClick={() => { setFaceTagging(value => !value); setFaceDraft(null); setFaceMessage(""); setZoom(1); }}>{faceTagging ? "Cancel tagging" : "Tag someone"}</button>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="photoStoryImageViewport" onDoubleClick={() => setZoom(value => value === 1 ? 2.5 : 1)}>
        {imageLoading && !imageFailed && <p className="photoStoryImageLoading" role="status">Opening the photograph...</p>}
        {imageFailed ? <div className="photoStoryImageFallback"><strong>The photograph needs another moment.</strong><button type="button" onClick={() => { setImageFailed(false); setImageLoading(true); setImageAttempt(value => value + 1); }}>Try again</button></div> : <img key={imageAttempt} ref={imageRef} className={`${imageLoading ? "is-loading " : ""}${faceTagging ? "is-face-tagging" : ""}`} src={fullImageSrc} alt={alt} data-media-id={mediaId} onPointerUp={chooseFace} style={{ transform: `scale(${zoom})` }} onLoad={() => setImageLoading(false)} onError={() => { setImageLoading(false); setImageFailed(true); }} />}
      </div>
      <section className="photoStoryPanel" aria-label="Stories attached to this photograph">
        {(faceTagging || faceMessage) && <div className="publicFaceTagger"><div><strong>Tag someone in this photograph</strong><p>{faceTagging ? "Tap the center of a face above, then enter the person's name. Tags are reviewed before appearing publicly." : faceMessage}</p></div>{faceTagging && <><label>Person&apos;s name<input value={faceName} onChange={event => setFaceName(event.target.value)} maxLength={80} placeholder="Who is this?" /></label><button type="button" disabled={faceSending || !faceDraft || !faceName.trim()} onClick={submitFaceTag}>{faceSending ? "Sending\u2026" : "Submit face tag"}</button></>}<p role="status">{faceTagging ? faceMessage : ""}</p></div>}
        <form className="photoStoryForm" onSubmit={submit}>
          <header><span>WHO’S HERE? WHAT DO YOU REMEMBER?</span><h2>Add to this photograph.</h2><p>Names, a detail, an impression, or a whole story—anything you remember belongs here.</p></header>
          <div className="photoStoryFields">
            <label>Your name <small>Optional</small><input value={authorName} onChange={event => setAuthorName(event.target.value)} maxLength={80} placeholder="So Sandi knows who shared it" /></label>
            <label>People in the photograph <small>Separate names with commas</small><input value={peopleText} onChange={event => setPeopleText(event.target.value)} maxLength={500} placeholder="Sandi, Jenny, Emile…" /></label>
            <label className="photoStoryMemory">A memory or description <small>Optional if you added a name above</small><textarea value={memory} onChange={event => setMemory(event.target.value)} maxLength={1200} rows={3} placeholder="I remember this day because…" /></label>
          </div>
          <label className="photoStoryHoneypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" /></label>
          <div className="photoStorySubmit"><button type="submit" disabled={sending}>{sending ? "Adding…" : "Add to this photograph"}</button><p role="status">{message}</p></div>
        </form>
        <div className={stories.length > 2 ? "photoStoryStream is-moving" : "photoStoryStream"} aria-label="Memories and identifications shared for this photograph">
          {loading ? <p className="photoStoryEmpty">Gathering what people remember…</p> : stories.length === 0 ? <p className="photoStoryEmpty">Be the first to name someone or leave a memory beneath this photograph.</p> : (
            <div className="photoStoryTrack">
              {storyCopies.map(duplicate => <div className="photoStoryGroup" aria-hidden={duplicate || undefined} key={duplicate ? "duplicate" : "original"}>{stories.map(story => <article key={story.id + (duplicate ? "-duplicate" : "")}><div>{story.people.map(person => <span key={person}>{person}</span>)}</div>{story.memory && <blockquote>{story.memory}</blockquote>}<footer>{story.authorName}</footer></article>)}</div>)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
  return createPortal(dialog, document.body);
}
