"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { StoryWorkshop } from "@/components/StoryWorkshop";
import { FamilyQaStudio } from "@/components/FamilyQaStudio";

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
  exif_status?: "pending" | "completed" | "unavailable" | "failed";
  exif_captured_at?: string | null;
  exif_latitude?: number | null;
  exif_longitude?: number | null;
  analysis_status?: "unprocessed" | "queued" | "processing" | "completed" | "review_required" | "failed" | "skipped";
  analysis_era?: string | null;
  analysis_decade?: number | null;
  analysis_setting?: string | null;
  analysis_people_count?: number | null;
  analysis_composition?: string | null;
  analysis_description?: string | null;
  analysis_objects?: string[];
  analysis_occasion_markers?: string[];
  analysis_event_clues?: string[];
  analysis_confidence?: Record<string, number> | null;
  analysis_error?: string | null;
  inferred_year_start?: number | null;
  inferred_year_end?: number | null;
  date_inference_source?: string | null;
  assignment_confidence?: number | null;
  assignment_rationale?: string | null;
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
  const [filter, setFilter] = useState<"visible" | "hidden">("visible");
  const [backupNotice, setBackupNotice] = useState("");
  const [backingUp, setBackingUp] = useState(false);
  const [intelligenceAvailable, setIntelligenceAvailable] = useState(true);
  const [query, setQuery] = useState("");
  const [era, setEra] = useState("");
  const [chapterFacet, setChapterFacet] = useState("");
  const [person, setPerson] = useState("");
  const [place, setPlace] = useState("");
  const [setting, setSetting] = useState("");
  const [tagState, setTagState] = useState<"all" | "untagged" | "low" | "ready">("all");
  const [pilotRunning, setPilotRunning] = useState(false);
  const [pilotNotice, setPilotNotice] = useState("");
  const [revealPublic, setRevealPublic] = useState(false);
  const [revealAccessAvailable, setRevealAccessAvailable] = useState(true);
  const [revealAccessWorking, setRevealAccessWorking] = useState(false);

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
    setIntelligenceAvailable(body.intelligenceAvailable !== false);
    const revealResponse = await fetch("/api/studio/reveal-access", { cache: "no-store" });
    if (revealResponse.ok) {
      const revealBody = await revealResponse.json();
      setRevealPublic(Boolean(revealBody.revealPublic));
      setRevealAccessAvailable(true);
    } else {
      setRevealAccessAvailable(false);
    }
    setSignedIn(true);
    setSessionReady(true);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!sessionReady) {
    return <section className="studioGate"><p>Opening the private editing room…</p></section>;
  }

  if (!signedIn) {
    return <StudioLogin onSignedIn={load} error={error} />;
  }

  const regularSubmissions = submissions.filter(submission => submission.status !== "family_qa");
  const normalizedQuery = query.trim().toLowerCase();
  const mediaMatchesFacets = (item: MediaItem) => {
    if (era && item.analysis_era !== era) return false;
    if (chapterFacet && item.chapter_number !== Number(chapterFacet)) return false;
    if (setting && item.analysis_setting !== setting) return false;
    if (tagState === "untagged" && !(!item.analysis_status || ["unprocessed", "queued", "processing"].includes(item.analysis_status))) return false;
    if (tagState === "low" && !["review_required", "failed"].includes(item.analysis_status || "")) return false;
    if (tagState === "ready" && item.analysis_status !== "completed") return false;
    return true;
  };

  const visible = regularSubmissions.filter(submission => {
    const hidden = submission.review_status === "excluded";
    if (filter === "visible" ? hidden : !hidden) return false;
    if (person && !submission.people.some(value => value === person)) return false;
    if (place && submission.location !== place) return false;
    if ((era || chapterFacet || setting || tagState !== "all") && !submission.media.some(mediaMatchesFacets)) return false;
    if (!normalizedQuery) return true;
    const searchable = [
      submission.name,
      submission.relationship,
      submission.first_memory,
      submission.story,
      submission.approximate_year,
      submission.location,
      submission.life_chapter,
      ...submission.people,
      ...submission.media.flatMap(item => [
        item.original_name,
        item.caption || "",
        item.analysis_description || "",
        item.analysis_era || "",
        item.analysis_setting || "",
        ...(item.analysis_objects || []),
        ...(item.analysis_occasion_markers || []),
        ...(item.analysis_event_clues || [])
      ])
    ].join(" ").toLowerCase();
    return searchable.includes(normalizedQuery);
  });

  const allMedia = regularSubmissions.flatMap(submission => submission.media);
  const photoMedia = allMedia.filter(item => item.mime_type.startsWith("image/"));
  const analyzedPhotos = photoMedia.filter(item => item.analysis_status === "completed" || item.analysis_status === "review_required");
  const lowConfidencePhotos = photoMedia.filter(item => item.analysis_status === "review_required" || item.analysis_status === "failed");
  const untaggedPhotos = photoMedia.filter(item => !item.analysis_status || ["unprocessed", "queued", "processing"].includes(item.analysis_status));
  const eras = Array.from(new Set(photoMedia.map(item => item.analysis_era).filter((value): value is string => Boolean(value)))).sort();
  const settings = Array.from(new Set(photoMedia.map(item => item.analysis_setting).filter((value): value is string => Boolean(value)))).sort();
  const people = Array.from(new Set(regularSubmissions.flatMap(item => item.people).filter(Boolean))).sort();
  const places = Array.from(new Set(regularSubmissions.map(item => item.location).filter(Boolean))).sort();

  const storyCounts = regularSubmissions.reduce((totals, submission) => {
    if (submission.review_status === "excluded") totals.hidden += 1;
    else totals.visible += 1;
    return totals;
  }, { visible: 0, hidden: 0 });

  const counts = regularSubmissions.reduce((totals, submission) => {
    for (const item of submission.media) {
      totals.total += 1;
      if (item.review_status === "excluded") totals.hidden += 1;
      else totals.visible += 1;
    }
    return totals;
  }, { total: 0, visible: 0, hidden: 0 });

  async function reviewSubmission(submissionId: string, reviewStatus: "included" | "excluded") {
    setError("");
    const response = await fetch("/api/studio/submission-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, reviewStatus })
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "The contribution visibility could not be saved.");
      return;
    }
    await load();
  }

  async function toggleRevealAccess() {
    setRevealAccessWorking(true);
    setError("");
    const response = await fetch("/api/studio/reveal-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revealPublic: !revealPublic })
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "Reveal access could not be changed.");
    else {
      setRevealPublic(Boolean(body.revealPublic));
      setRevealAccessAvailable(true);
    }
    setRevealAccessWorking(false);
  }

  async function runPhotoPilot() {
    setPilotRunning(true);
    setError("");
    setPilotNotice("");
    const response = await fetch("/api/studio/photo-intelligence/pilot", { method: "POST" });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || body.detail || "The ten-photo pilot could not run.");
    } else {
      const processed = Array.isArray(body.processed) ? body.processed.length : 0;
      setPilotNotice(processed
        ? `The pilot processed ${processed} photograph${processed === 1 ? "" : "s"}. Check every low-confidence flag before relying on an assignment.`
        : "No queued photographs are waiting for the pilot.");
      await load();
    }
    setPilotRunning(false);
  }

  async function verifyBackups() {
    setBackingUp(true);
    setError("");
    setBackupNotice("");
    const response = await fetch("/api/studio/backups", { method: "POST" });
    const body = await response.json();
    if (!response.ok || !body.ok) {
      const firstFailure = body.failures?.[0];
      setError(firstFailure
        ? `Backup verification found ${body.failureCount} problem${body.failureCount === 1 ? "" : "s"}. First: ${firstFailure.name} — ${firstFailure.reason}`
        : body.error || "Backup verification failed.");
    } else {
      setBackupNotice(`Verified ${body.fileCount} files across ${body.submissionCount} contributions. Every primary and backup object matched its recorded byte count.`);
    }
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
          <p>{regularSubmissions.length} contributions · {counts.total} files · {storyCounts.hidden} contributions and {counts.hidden} files hidden</p>
        </div>
        <div className="studioToolbarActions">
          <button
            className={revealPublic ? "secondary revealAccess isPublic" : "secondary revealAccess"}
            type="button"
            aria-pressed={revealPublic}
            disabled={revealAccessWorking || !revealAccessAvailable}
            onClick={toggleRevealAccess}
          >
            {revealAccessWorking ? "Changing access…" : revealPublic ? "Reveal is open — close it" : "Open reveal publicly"}
          </button>
          <button className="secondary" type="button" disabled={backingUp} onClick={verifyBackups}>{backingUp ? "Verifying backups…" : "Verify all backups"}</button>
          <a className="secondary" href="/api/studio/export">Download archive index</a>
          <a className="secondary" href="/reveal">Open private reveal</a>
          <button className="secondary" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="studioIntelligence" aria-labelledby="photo-intelligence-title">
        <header>
          <div>
            <span className="eyebrow">PHOTO INTELLIGENCE</span>
            <h2 id="photo-intelligence-title">Find the thread without losing the source.</h2>
            <p>Contributor details remain authoritative. Visual analysis fills only blank fields; uncertain assignments remain visible so you can correct them.</p>
          </div>
          <dl>
            <div><dt>Photographs</dt><dd>{photoMedia.length}</dd></div>
            <div><dt>Analyzed</dt><dd>{analyzedPhotos.length}</dd></div>
            <div><dt>Low confidence</dt><dd>{lowConfidencePhotos.length}</dd></div>
            <div><dt>Untagged</dt><dd>{untaggedPhotos.length}</dd></div>
          </dl>
        </header>
        {!intelligenceAvailable && (
          <p className="studioWarning" role="status">The analysis migration has not been installed yet. Contributions remain safe; search is currently limited to contributor-supplied details.</p>
        )}
        <div className="studioSearchControls">
          <label className="studioSearch">Search every memory
            <input value={query} onChange={event => setQuery(event.target.value)} type="search" placeholder="A person, place, year, setting, or phrase" />
          </label>
          <label>Era
            <select value={era} onChange={event => setEra(event.target.value)}>
              <option value="">All eras</option>
              {eras.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Chapter
            <select value={chapterFacet} onChange={event => setChapterFacet(event.target.value)}>
              <option value="">All chapters</option>
              {Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={index + 1}>Chapter {index + 1}</option>)}
            </select>
          </label>
          <label>Person
            <select value={person} onChange={event => setPerson(event.target.value)}>
              <option value="">Everyone</option>
              {people.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Place
            <select value={place} onChange={event => setPlace(event.target.value)}>
              <option value="">Everywhere</option>
              {places.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Setting
            <select value={setting} onChange={event => setSetting(event.target.value)}>
              <option value="">All settings</option>
              {settings.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Tagging state
            <select value={tagState} onChange={event => setTagState(event.target.value as typeof tagState)}>
              <option value="all">All states</option>
              <option value="untagged">Untagged or queued</option>
              <option value="low">Low confidence or failed</option>
              <option value="ready">Analyzed</option>
            </select>
          </label>
          <div className="studioSearchActions">
            <button className="secondary" type="button" disabled={pilotRunning || !intelligenceAvailable} onClick={runPhotoPilot}>
              {pilotRunning ? "Analyzing ten photographs…" : "Run ten-photo pilot"}
            </button>
            <button className="secondary" type="button" onClick={() => {
              setQuery(""); setEra(""); setChapterFacet(""); setPerson(""); setPlace(""); setSetting(""); setTagState("all");
            }}>Clear search</button>
          </div>
        </div>
        {pilotNotice && <p className="studioNotice" role="status">{pilotNotice}</p>}
      </section>

      <nav className="studioFilters" aria-label="Contribution visibility">
        <button type="button" aria-pressed={filter === "visible"} onClick={() => setFilter("visible")}>Visible · {storyCounts.visible}</button>
        <button type="button" aria-pressed={filter === "hidden"} onClick={() => setFilter("hidden")}>Hidden · {storyCounts.hidden}</button>
      </nav>

      {error && <p className="studioError" role="alert">{error}</p>}
      {backupNotice && <p className="studioNotice" role="status">{backupNotice}</p>}
      {!visible.length && <div className="studioEmpty">Nothing is in this view.</div>}

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
            <div className="studioSubmissionDecision" aria-label={`Visibility for ${submission.name}`}>
              <span>Contribution: <strong>{submission.review_status === "excluded" ? "hidden" : "visible"}</strong></span>
              {submission.review_status === "excluded"
                ? <button type="button" className="include" onClick={() => reviewSubmission(submission.id, "included")}>Restore contribution</button>
                : <button type="button" className="exclude" onClick={() => reviewSubmission(submission.id, "excluded")}>Hide contribution</button>}
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

      <FamilyQaStudio
        media={regularSubmissions.flatMap(submission => submission.media.map(item => ({
          id: item.id,
          originalName: item.original_name,
          mimeType: item.mime_type,
          contributorName: submission.name
        })))}
      />

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
        <p>Only the project owner can organize memories or retrieve files.</p>
        <label>Email<input name="email" type="email" autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <p className="studioError" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={working}>{working ? "Signing in…" : "Sign in"}</button>
      </form>
    </section>
  );
}

function ReviewMediaCard({ item, onSaved }: { item: MediaItem; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState<"included" | "excluded">(item.review_status === "excluded" ? "excluded" : "included");
  const [chapter, setChapter] = useState(item.chapter_number ? String(item.chapter_number) : "");
  const [caption, setCaption] = useState(item.caption ?? "");
  const [notes, setNotes] = useState(item.reviewer_notes ?? "");
  const [order, setOrder] = useState(String(item.display_order));
  const [saving, setSaving] = useState(false);
  const [posterReady, setPosterReady] = useState(Boolean(item.poster_path));
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  async function save(nextStatus: "included" | "excluded" = status) {
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
    if (!response.ok) setError(body.error || "Visibility could not be saved.");
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
        ) : item.mime_type.startsWith("image/") ? (
          <ReviewImage
            src={mediaUrl}
            downloadUrl={`${mediaUrl}?download=1`}
            name={item.original_name}
            alt={caption || `Submitted photograph: ${item.original_name}`}
          />
        ) : item.mime_type.startsWith("audio/") ? (
          <audio controls preload="metadata"><source src={mediaUrl} type={item.mime_type} /></audio>
        ) : (
          <a className="downloadFile" href={mediaUrl} target="_blank" rel="noreferrer">Open {item.original_name}</a>
        )}
      </div>
      <div className="reviewFields">
        <strong>{item.original_name}</strong>
        <small>{formatBytes(item.bytes)}</small>
        {item.mime_type.startsWith("image/") && (
          <div className={`intelligenceCard intelligence-${item.analysis_status || "unprocessed"}`}>
            <div className="intelligenceStatus">
              <span>{(item.analysis_status || "unprocessed").replaceAll("_", " ")}</span>
              {item.assignment_confidence != null && <span>{Math.round(item.assignment_confidence * 100)}% chapter confidence</span>}
            </div>
            {item.analysis_description && <p>{item.analysis_description}</p>}
            <dl>
              {item.analysis_era && <><dt>Era</dt><dd>{item.analysis_era}{item.analysis_decade ? ` · ${item.analysis_decade}s` : ""}</dd></>}
              {item.analysis_setting && <><dt>Setting</dt><dd>{item.analysis_setting}</dd></>}
              {item.analysis_composition && <><dt>Frame</dt><dd>{item.analysis_composition}{item.analysis_people_count != null ? ` · about ${item.analysis_people_count} ${item.analysis_people_count === 1 ? "person" : "people"}` : ""}</dd></>}
              {item.inferred_year_start && <><dt>Date</dt><dd>{item.inferred_year_end && item.inferred_year_end !== item.inferred_year_start ? `${item.inferred_year_start}–${item.inferred_year_end}` : item.inferred_year_start} <small>{item.date_inference_source === "exif" ? "from original EXIF" : "soft visual range"}</small></dd></>}
              {item.analysis_objects?.length ? <><dt>Details</dt><dd>{item.analysis_objects.join(", ")}</dd></> : null}
            </dl>
            {item.assignment_rationale && <p className="assignmentRationale">{item.assignment_rationale}</p>}
            {item.analysis_error && <p className="studioError">{item.analysis_error}</p>}
          </div>
        )}
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
          {status === "excluded"
            ? <button type="button" className="include" disabled={saving} onClick={() => save("included")}>Restore to reveal</button>
            : <button type="button" className="exclude" disabled={saving} onClick={() => save("excluded")}>Hide from reveal</button>}
          <button type="button" className="secondary compact" disabled={saving} onClick={() => save(status)}>Save details</button>
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


function ReviewImage({ src, downloadUrl, name, alt }: { src: string; downloadUrl: string; name: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="unsupportedPreview">
        <strong>iPhone original preserved</strong>
        <p>This browser cannot display the HEIC original. Open Studio in Safari or download the file and add a JPEG presentation copy.</p>
        <a className="downloadFile" href={downloadUrl}>Download {name}</a>
      </div>
    );
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}
