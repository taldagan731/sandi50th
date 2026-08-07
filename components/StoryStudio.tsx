"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { StoryWorkshop } from "@/components/StoryWorkshop";

type MediaItem = {
  id: string;
  submission_id: string;
  original_name: string;
  mime_type: string;
  bytes: number;
  review_status: "pending" | "included" | "excluded";
  chapter_number: number | null;
  caption: string | null;
  reviewer_notes: string | null;
  poster_path: string | null;
  display_order: number;
};

type Submission = {
  id: string;
  name: string;
  contact: string;
  relationship: string;
  first_memory: string;
  story: string;
  approximate_year: string;
  location: string;
  people: string[];
  life_chapter: string;
  prompt: string;
  status: string;
  review_status: "pending" | "included" | "excluded";
  created_at: string;
  media: MediaItem[];
};

export function StoryStudio() {
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "included">("all");
  const [backupNotice, setBackupNotice] = useState("");
  const [backingUp, setBackingUp] = useState(false);

  async function load() {
    setError("");
    const response = await fetch("/api/studio/contributions", { cache: "no-store" });
    if (response.status === 401) {
      setSignedIn(false);
      setSessionReady(true);
      return;
    }
    const body = await response.json();
    if (!response.ok) {
      setError(body.detail || body.error || "The studio could not be loaded.");
      setSessionReady(true);
      return;
    }
    setSubmissions(body.submissions);
    setSignedIn(true);
    setSessionReady(true);
  }

  useEffect(() => { void load(); }, []);

  if (!sessionReady) {
    return <section className="studioGate"><p>Opening the private editing room…</p></section>;
  }

  if (!signedIn) {
    return <StudioLogin onSignedIn={load} error={error} />;
  }

  const visible = submissions.filter(submission => {
    if (filter === "all") return true;
    if (filter === "pending") return submission.review_status === "pending" || submission.media.some(item => item.review_status === "pending");
    return submission.review_status === "included" || submission.media.some(item => item.review_status === "included");
  });

  const storyCounts = submissions.reduce((totals, submission) => {
    totals[submission.review_status] += 1;
    return totals;
  }, { pending: 0, included: 0, excluded: 0 });

  const counts = submissions.reduce((totals, submission) => {
    for (const item of submission.media) {
      totals.total += 1;
      if (item.review_status === "pending") totals.pending += 1;
      if (item.review_status === "included") totals.included += 1;
    }
    return totals;
  }, { total: 0, pending: 0, included: 0 });

  async function reviewSubmission(submissionId: string, reviewStatus: "pending" | "included" | "excluded") {
    setError("");
    const response = await fetch("/api/studio/submission-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, reviewStatus })
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "The contribution decision could not be saved.");
      return;
    }
    await load();
  }

  async function verifyBackups() {
    setBackingUp(true);
    setError("");
    setBackupNotice("");
    const response = await fetch("/api/studio/backups", { method: "POST" });
    const body = await response.json();
    if (!response.ok) setError(body.error || "Backup verification failed.");
    else setBackupNotice(`Verified ${body.fileCount} files across ${body.submissionCount} contributions.`);
    setBackingUp(false);
  }

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    await fetch("/api/studio/session", { method: "DELETE" });
    setSignedIn(false);
    setSubmissions([]);
  }

  return (
    <div className="studioApp">
      <header className="studioToolbar">
        <div>
          <span className="eyebrow">PRIVATE STORY STUDIO</span>
          <h1>The memories that have arrived.</h1>
          <p>{submissions.length} contributions · {counts.total} files · {storyCounts.pending} stories and {counts.pending} files awaiting a decision</p>
        </div>
        <div className="studioToolbarActions">
          <button className="secondary" type="button" disabled={backingUp} onClick={verifyBackups}>{backingUp ? "Verifying backups…" : "Verify all backups"}</button>
          <a className="secondary" href="/api/studio/export">Download archive index</a>
          <a className="secondary" href="/reveal">Open private reveal</a>
          <button className="secondary" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <nav className="studioFilters" aria-label="Contribution filters">
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
        <button type="button" aria-pressed={filter === "pending"} onClick={() => setFilter("pending")}>Needs review · {counts.pending}</button>
        <button type="button" aria-pressed={filter === "included"} onClick={() => setFilter("included")}>Included · {counts.included}</button>
      </nav>

      {error && <p className="studioError" role="alert">{error}</p>}
      {backupNotice && <p className="studioNotice" role="status">{backupNotice}</p>}
      {!visible.length && <div className="studioEmpty">Nothing is waiting in this view.</div>}

      <div className="studioSubmissions">
        {visible.map(submission => (
          <article className="studioSubmission" key={submission.id}>
            <header>
              <div>
                <span className="eyebrow">{submission.relationship || "CONTRIBUTOR"}</span>
                <h2>{submission.name}</h2>
              </div>
              <time>{new Date(submission.created_at).toLocaleString()}</time>
            </header>
            <div className="studioSubmissionDecision" aria-label={`Story decision for ${submission.name}`}>
              <span>Story: <strong>{submission.review_status}</strong></span>
              <button type="button" className={submission.review_status === "included" ? "include" : ""} onClick={() => reviewSubmission(submission.id, "included")}>Include story</button>
              <button type="button" className={submission.review_status === "excluded" ? "exclude" : ""} onClick={() => reviewSubmission(submission.id, "excluded")}>Exclude story</button>
              <button type="button" onClick={() => reviewSubmission(submission.id, "pending")}>Return to pending</button>
            </div>
            <div className="studioMemory">
              <blockquote>{submission.first_memory}</blockquote>
              {submission.story && <p>{submission.story}</p>}
              <dl>
                {submission.approximate_year && <><dt>When</dt><dd>{submission.approximate_year}</dd></>}
                {submission.location && <><dt>Where</dt><dd>{submission.location}</dd></>}
                {submission.life_chapter && <><dt>Suggested chapter</dt><dd>{submission.life_chapter}</dd></>}
                <dt>Contact</dt><dd>{submission.contact}</dd>
              </dl>
            </div>
            {submission.media.length ? (
              <div className="studioMediaGrid">
                {submission.media.map(item => (
                  <ReviewMediaCard key={item.id} item={item} onSaved={load} />
                ))}
              </div>
            ) : (
              <p className="textOnlyMemory">Text-only contribution</p>
            )}
          </article>
        ))}
      </div>

      <StoryWorkshop />
    </div>
  );
}

function StudioLogin({ onSignedIn, error: initialError }: { onSignedIn: () => Promise<void>; error: string }) {
  const [error, setError] = useState(initialError);
  const [working, setWorking] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const supabase = createBrowserSupabaseClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !data.session) {
      setError(authError?.message || "Sign-in failed.");
      setWorking(false);
      return;
    }
    const response = await fetch("/api/studio/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: data.session.access_token })
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "This account is not authorized.");
      setWorking(false);
      return;
    }
    await onSignedIn();
    setWorking(false);
  }

  return (
    <section className="studioGate">
      <form onSubmit={signIn}>
        <span className="eyebrow">PRIVATE STORY STUDIO</span>
        <h1>Enter the editing room.</h1>
        <p>Only the project owner can review memories or retrieve files.</p>
        <label>Email<input name="email" type="email" autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <p className="studioError" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={working}>{working ? "Signing in…" : "Sign in"}</button>
      </form>
    </section>
  );
}

function ReviewMediaCard({ item, onSaved }: { item: MediaItem; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState(item.review_status);
  const [chapter, setChapter] = useState(item.chapter_number ? String(item.chapter_number) : "");
  const [caption, setCaption] = useState(item.caption ?? "");
  const [notes, setNotes] = useState(item.reviewer_notes ?? "");
  const [order, setOrder] = useState(String(item.display_order));
  const [saving, setSaving] = useState(false);
  const [posterReady, setPosterReady] = useState(Boolean(item.poster_path));
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  async function save(nextStatus = status) {
    setSaving(true);
    setError("");
    const response = await fetch("/api/studio/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaId: item.id,
        reviewStatus: nextStatus,
        chapterNumber: chapter ? Number(chapter) : null,
        caption,
        notes,
        displayOrder: Number(order) || 0
      })
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "Decision could not be saved.");
    else {
      setStatus(nextStatus);
      await onSaved();
    }
    setSaving(false);
  }

  async function createPoster() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("Play or seek the video to the frame you want first.");
      return;
    }
    const canvas = document.createElement("canvas");
    const maxWidth = 1200;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.84));
    if (!blob) return;

    const form = new FormData();
    form.append("mediaId", item.id);
    form.append("poster", blob, "poster.jpg");
    const response = await fetch("/api/studio/poster", { method: "POST", body: form });
    const body = await response.json();
    if (!response.ok) setError(body.error || "Poster frame could not be created.");
    else {
      setPosterReady(true);
      await onSaved();
    }
  }

  const mediaUrl = `/api/studio/media/${item.id}`;
  return (
    <section className={`reviewMedia review-${status}`}>
      <div className="reviewPreview">
        {item.mime_type.startsWith("video/") ? (
          <video ref={videoRef} controls preload="metadata" poster={posterReady ? `${mediaUrl}?poster=1` : undefined}>
            <source src={mediaUrl} type={item.mime_type} />
          </video>
        ) : item.mime_type === "image/heic" || item.mime_type === "image/heif" ? (
          <div className="unsupportedPreview">
            <strong>iPhone original preserved</strong>
            <p>This browser cannot reliably display HEIC. Download the original to review it, then add a JPEG copy before including it in the reveal.</p>
            <a className="downloadFile" href={`${mediaUrl}?download=1`}>Download {item.original_name}</a>
          </div>
        ) : item.mime_type.startsWith("image/") ? (
          <img src={mediaUrl} alt={caption || `Submitted photograph: ${item.original_name}`} />
        ) : item.mime_type.startsWith("audio/") ? (
          <audio controls preload="metadata"><source src={mediaUrl} type={item.mime_type} /></audio>
        ) : (
          <a className="downloadFile" href={mediaUrl} target="_blank" rel="noreferrer">Open {item.original_name}</a>
        )}
      </div>
      <div className="reviewFields">
        <strong>{item.original_name}</strong>
        <small>{formatBytes(item.bytes)}</small>
        <label>Chapter
          <select value={chapter} onChange={event => setChapter(event.target.value)}>
            <option value="">Unassigned</option>
            {Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={index + 1}>Chapter {index + 1}</option>)}
          </select>
        </label>
        <label>Caption<textarea rows={2} value={caption} onChange={event => setCaption(event.target.value)} /></label>
        <label>Order in chapter<input type="number" min="0" max="10000" value={order} onChange={event => setOrder(event.target.value)} /></label>
        <label>Private notes<textarea rows={2} value={notes} onChange={event => setNotes(event.target.value)} /></label>
        {item.mime_type.startsWith("video/") && (
          <button className="secondary compact" type="button" onClick={createPoster}>
            {posterReady ? "Replace poster with current frame" : "Use current frame as poster"}
          </button>
        )}
        <div className="reviewActions">
          <button type="button" className="include" disabled={saving} onClick={() => save("included")}>Include</button>
          <button type="button" className="exclude" disabled={saving} onClick={() => save("excluded")}>Exclude</button>
          <button type="button" className="secondary compact" disabled={saving} onClick={() => save(status)}>Save notes</button>
        </div>
        {error && <p className="studioError" role="alert">{error}</p>}
      </div>
    </section>
  );
}

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
