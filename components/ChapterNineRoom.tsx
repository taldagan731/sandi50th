"use client";

import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type MediaItem = {
  id: string;
  original_name: string;
  mime_type: string;
  bytes: number;
  created_at: string;
};

type Entry = {
  id: string;
  body: string;
  dateLabel: string;
  createdAt: string;
  updatedAt: string;
  media: MediaItem[];
};

type DraftFile = {
  id: string;
  file: File;
  preview: string;
  status: "ready" | "uploading" | "uploaded" | "failed";
  error: string;
};

type PreparedUpload = {
  pathname: string;
  name: string;
  type: string;
  size: number;
};

type CompletedFile = PutBlobResult & {
  originalName: string;
  bytes: number;
  contentType: string;
};

const MAX_FILES = 24;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
const PARALLEL_UPLOADS = 3;

export function ChapterNineRoom() {
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [body, setBody] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [activeTask, setActiveTask] = useState("");
  const completed = useRef<Record<string, CompletedFile>>({});

  const totalSize = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);
  const totalProgress = useMemo(() => {
    if (!files.length || !totalSize) return working ? 12 : 0;
    const loaded = files.reduce(
      (sum, item) => sum + item.file.size * ((progress[item.id] ?? 0) / 100),
      0
    );
    return Math.min(100, (loaded / totalSize) * 100);
  }, [files, progress, totalSize, working]);

  async function load() {
    setError("");
    const response = await fetch("/api/chapter-nine/entries", { cache: "no-store" });
    if (response.status === 401) {
      setSignedIn(false);
      setSessionReady(true);
      return;
    }
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Chapter Nine could not be opened.");
      setSessionReady(true);
      return;
    }
    setEntries(payload.entries);
    setSignedIn(true);
    setSessionReady(true);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      for (const file of files) if (file.preview) URL.revokeObjectURL(file.preview);
    };
  }, [files]);

  function addIncoming(incoming: File[]) {
    const accepted: DraftFile[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      const type = normalizedImageType(file);
      if (!type) {
        rejected.push(`${file.name} is not a supported image type.`);
        continue;
      }
      const id = [file.name, file.size, file.lastModified].join("-");
      accepted.push({
        id,
        file: new File([file], file.name, { type, lastModified: file.lastModified }),
        preview: URL.createObjectURL(file),
        status: "ready",
        error: ""
      });
    }

    setFiles(current => {
      const ids = new Set(current.map(item => item.id));
      const unique = accepted.filter(item => !ids.has(item.id));
      const room = Math.max(0, MAX_FILES - current.length);
      const added = unique.slice(0, room);
      for (const item of unique.slice(room)) if (item.preview) URL.revokeObjectURL(item.preview);
      const combined = [...current, ...added];
      const bytes = combined.reduce((sum, item) => sum + item.file.size, 0);
      if (bytes > MAX_TOTAL_BYTES) {
        for (const item of added) if (item.preview) URL.revokeObjectURL(item.preview);
        setError("These photographs exceed the 2 GB page limit. Split them across two pages.");
        return current;
      }
      setError(rejected.join(" "));
      return combined;
    });
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    addIncoming(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function removeFile(id: string) {
    if (working) return;
    setFiles(current => {
      const removed = current.find(item => item.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return current.filter(item => item.id !== id);
    });
  }

  function beginEdit(entry: Entry) {
    setEditingId(entry.id);
    setBody(entry.body);
    setDateLabel(entry.dateLabel);
    setFiles([]);
    setRemovedMediaIds([]);
    completed.current = {};
    setProgress({});
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startFresh() {
    setEditingId(null);
    setBody("");
    setDateLabel("");
    setFiles([]);
    setRemovedMediaIds([]);
    completed.current = {};
    setProgress({});
    setActiveTask("");
    setNotice("");
    setError("");
  }

  async function deleteEntry(id: string) {
    if (!window.confirm("Remove this page from Chapter Nine? The backup copy will still be preserved.")) return;
    setWorking(true);
    setError("");
    const response = await fetch(`/api/chapter-nine/entries/${id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "This page could not be removed.");
      setWorking(false);
      return;
    }
    if (editingId === id) startFresh();
    setNotice("That page has been removed from Chapter Nine.");
    await load();
    setWorking(false);
  }

  async function signOut() {
    await fetch("/api/chapter-nine/session", { method: "DELETE" });
    setSignedIn(false);
    setEntries([]);
    startFresh();
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/chapter-nine/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: String(form.get("passphrase") ?? "") })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Chapter Nine could not be opened.");
      setWorking(false);
      return;
    }
    await load();
    setWorking(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || !dateLabel.trim()) {
      setError("Give this page a date and a few words before you place it in the book.");
      return;
    }

    setWorking(true);
    setError("");
    setNotice("");
    setActiveTask(editingId ? "Updating this page…" : "Opening a new page…");
    completed.current = {};

    try {
      const endpoint = editingId ? `/api/chapter-nine/entries/${editingId}` : "/api/chapter-nine/entries";
      const method = editingId ? "PATCH" : "POST";
      const prepareResponse = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          dateLabel,
          files: files.map(item => ({
            name: item.file.name,
            type: item.file.type,
            size: item.file.size
          }))
        })
      });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) throw new Error(prepared.error || "This page could not be prepared.");

      const pending = files.filter(item => !completed.current[item.id]);
      const uploads = prepared.uploads as PreparedUpload[];
      let cursor = 0;

      async function worker() {
        while (cursor < pending.length) {
          const index = cursor;
          cursor += 1;
          const draft = pending[index];
          const target = uploads[index];
          if (!target) continue;
          setActiveTask(`Adding ${draft.file.name}…`);
          const blob = await uploadWithRetry(prepared.entryId, target, draft, percentage => {
            setProgress(current => ({ ...current, [draft.id]: percentage }));
          });
          completed.current[draft.id] = {
            ...blob,
            originalName: draft.file.name,
            bytes: draft.file.size,
            contentType: draft.file.type
          };
        }
      }

      await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, Math.max(1, pending.length)) }, worker));

      setActiveTask("Placing this page into Chapter Nine…");
      const completeResponse = await fetch(`/api/chapter-nine/entries/${prepared.entryId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: Object.values(completed.current),
          removedMediaIds
        })
      });
      const result = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(result.error || "This page could not be confirmed.");

      setNotice(editingId ? "This page has been updated in Chapter Nine." : "A new page has entered Chapter Nine.");
      startFresh();
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "This page could not be placed yet.");
    }

    setWorking(false);
    setActiveTask("");
  }

  if (!sessionReady) {
    return <section className="chapterNineGate"><p>Opening Chapter Nine…</p></section>;
  }

  if (!signedIn) {
    return (
      <section className="chapterNineGate">
        <div className="chapterNineGateCopy">
          <span className="eyebrow">CHAPTER NINE</span>
          <h1>The rest is yours to write.</h1>
          <p>This room belongs to Sandi. A page can be a memory, a photograph, a date, or a turn the story has not taken yet.</p>
          <p>Nothing here asks for polish. Write it the way you would keep it.</p>
        </div>
        <form className="chapterNineGateForm" onSubmit={signIn}>
          <label>
            Passphrase
            <input name="passphrase" type="password" autoComplete="current-password" required />
          </label>
          {error && <p className="chapterNineError" role="alert">{error}</p>}
          <button className="primary" type="submit" disabled={working}>{working ? "Opening…" : "Open Chapter Nine"}</button>
        </form>
      </section>
    );
  }

  const editingEntry = editingId ? entries.find(entry => entry.id === editingId) ?? null : null;

  return (
    <div className="chapterNineRoom">
      <header className="chapterNineMasthead">
        <div>
          <span className="eyebrow">CHAPTER NINE</span>
          <h1>Still becoming, in her own hand.</h1>
          <p>This is not a CMS. It is the place where Sandi keeps writing the story after the birthday film ends.</p>
        </div>
        <div className="chapterNineMastheadActions">
          {editingId && <button className="secondary" type="button" onClick={startFresh}>Start a fresh page</button>}
          <button className="secondary" type="button" onClick={signOut}>Close Chapter Nine</button>
        </div>
      </header>

      <section className="chapterNineComposer">
        <div className="chapterNineComposerIntro">
          <span className="eyebrow">{editingId ? "RETURN TO THIS PAGE" : "OPEN A NEW PAGE"}</span>
          <h2>{editingId ? "Say what changed, and let it stay." : "Write what belongs to the next chapter."}</h2>
        </div>
        <form className="chapterNineComposerForm" onSubmit={submit}>
          <label className="chapterNineDate">
            Date this page any way you like
            <input
              value={dateLabel}
              onChange={event => setDateLabel(event.target.value)}
              placeholder="August 12, 2026 · Late summer · This morning"
              maxLength={120}
              required
            />
          </label>
          <label className="chapterNineBody">
            <span className="srOnly">Page text</span>
            <textarea
              value={body}
              onChange={event => setBody(event.target.value)}
              rows={10}
              placeholder="Write it the way it comes."
              maxLength={12000}
              required
            />
          </label>

          <div className="chapterNineUpload">
            <div>
              <strong>Add her own photographs, if they belong here.</strong>
              <p>Choose images directly from this device. They will be verified and backed up the same way the contribution archive is.</p>
            </div>
            <label className="filePicker secondary">
              Choose photographs
              <input type="file" multiple accept="image/*,.heic,.heif" onChange={chooseFiles} />
            </label>
          </div>

          {editingEntry?.media.length ? (
            <div className="chapterNineExistingMedia">
              <span className="eyebrow">ALREADY ON THIS PAGE</span>
              <div className="chapterNineMediaGrid">
                {editingEntry.media.map(item => {
                  const removed = removedMediaIds.includes(item.id);
                  return (
                    <article key={item.id} className={removed ? "chapterNineThumb isRemoved" : "chapterNineThumb"}>
                      <img src={`/api/chapter-nine/media/${item.id}`} alt={item.original_name} />
                      <button type="button" onClick={() => setRemovedMediaIds(current => (
                        current.includes(item.id) ? current.filter(value => value !== item.id) : [...current, item.id]
                      ))}>
                        {removed ? "Keep on this page" : "Remove from this page"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {files.length ? (
            <div className="chapterNineSelectedMedia">
              <span className="eyebrow">NEW PHOTOGRAPHS FOR THIS PAGE</span>
              <div className="chapterNineMediaGrid">
                {files.map(item => (
                  <article key={item.id} className="chapterNineThumb">
                    <img src={item.preview} alt={item.file.name} />
                    <div>
                      <strong>{item.file.name}</strong>
                      <small>{progress[item.id] != null ? `${Math.round(progress[item.id])}%` : formatBytes(item.file.size)}</small>
                    </div>
                    <button type="button" disabled={working} onClick={() => removeFile(item.id)}>Remove</button>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {working && (
            <div className="uploadProgress" role="status" aria-live="polite">
              <span style={{ width: `${totalProgress}%` }} />
              <p>{activeTask} {files.length ? `${Math.round(totalProgress)}%` : ""}</p>
            </div>
          )}
          {error && <p className="chapterNineError" role="alert">{error}</p>}
          {notice && <p className="chapterNineNotice" role="status">{notice}</p>}
          <button className="primary chapterNineSubmit" type="submit" disabled={working}>
            {working ? "Please keep this page open…" : editingId ? "Return this page to Chapter Nine" : "Add this page to Chapter Nine"}
          </button>
        </form>
      </section>

      <section className="chapterNinePages" aria-labelledby="chapter-nine-pages">
        <header>
          <span className="eyebrow">THE PAGES THAT ARE ALREADY THERE</span>
          <h2 id="chapter-nine-pages">What has entered the book so far.</h2>
        </header>
        {!entries.length ? (
          <div className="chapterNineEmpty">
            <strong>No pages yet.</strong>
            <p>The invitation is waiting. The first page will appear here as soon as she writes it.</p>
          </div>
        ) : (
          <div className="chapterNineEntryList">
            {entries.map(entry => (
              <article key={entry.id} className="chapterNineEntryCard">
                <header>
                  <span>{entry.dateLabel}</span>
                  <div>
                    <button type="button" onClick={() => beginEdit(entry)}>Edit</button>
                    <button type="button" onClick={() => void deleteEntry(entry.id)}>Delete</button>
                  </div>
                </header>
                <div className="chapterNineEntryProse">
                  {entry.body.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                </div>
                {entry.media.length ? (
                  <div className="chapterNineEntryPhotos">
                    {entry.media.map(item => <img key={item.id} src={`/api/chapter-nine/media/${item.id}`} alt={item.original_name} />)}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

async function uploadWithRetry(
  entryId: string,
  target: PreparedUpload,
  draft: DraftFile,
  onProgress: (percentage: number) => void
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await upload(target.pathname, draft.file, {
        access: "private",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({
          submissionId: entryId,
          originalName: draft.file.name,
          bytes: draft.file.size,
          contentType: draft.file.type
        }),
        contentType: draft.file.type,
        multipart: draft.file.size >= MULTIPART_THRESHOLD,
        onUploadProgress: event => onProgress(event.percentage)
      });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => window.setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${draft.file.name} could not be uploaded after three attempts.`);
}

function normalizedImageType(file: File) {
  if (file.type.startsWith("image/")) return file.type.split(";")[0].toLowerCase();
  const name = file.name.toLowerCase();
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  return "";
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
