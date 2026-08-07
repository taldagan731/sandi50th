"use client";

import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";

const MAX_FILES = 20;
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024 * 1024;
const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
const EMAIL_FALLBACK = "mailto:uploads@sandi50th.com?subject=Sandi%2050th%20memory%20upload";

const chapters = [
  "Baby and early childhood",
  "Growing up in Roslyn",
  "School years",
  "Boston University",
  "Semester abroad in England",
  "Magazine advertising",
  "Oracle and career achievements",
  "Family and love",
  "Travel and adventure",
  "Friendship",
  "Sandi today",
  "Birthday wishes",
  "Not sure"
];

const prompts = [
  "What moment best captures who Sandi is?",
  "What is your earliest memory of Sandi?",
  "Tell us the funniest Sandi story you know.",
  "What has Sandi taught you?",
  "How has Sandi changed your life?",
  "What do you wish for her next fifty years?"
];

type SelectedFile = { file: File; id: string };
type PreparedUpload = { pathname: string; name: string; type: string; size: number };
type CompletedFile = PutBlobResult & { originalName: string; bytes: number };

export function MemoryContributionForm() {
  const [firstMemory, setFirstMemory] = useState("");
  const [opened, setOpened] = useState(false);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [confirmationId, setConfirmationId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeFile, setActiveFile] = useState("");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [uploadError, setUploadError] = useState("");

  const totalSize = useMemo(
    () => files.reduce((sum, item) => sum + item.file.size, 0),
    [files]
  );

  const totalProgress = useMemo(() => {
    if (!files.length || !totalSize) return uploading ? 20 : 0;
    const loaded = files.reduce(
      (sum, item) => sum + item.file.size * ((progress[item.id] ?? 0) / 100),
      0
    );
    return Math.min(100, (loaded / totalSize) * 100);
  }, [files, progress, totalSize, uploading]);

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    const oversized = incoming.find(file => file.size > MAX_FILE_BYTES);
    if (oversized) {
      setUploadError(`${oversized.name} is larger than the 5 GB per-file limit. Email us and we will arrange another transfer.`);
      event.target.value = "";
      return;
    }

    const selected = incoming.map(file => ({
      file,
      id: `${file.name}-${file.size}-${file.lastModified}`
    }));

    setFiles(current => {
      const ids = new Set(current.map(item => item.id));
      const combined = [...current, ...selected.filter(item => !ids.has(item.id))].slice(0, MAX_FILES);
      const combinedBytes = combined.reduce((sum, item) => sum + item.file.size, 0);
      if (combinedBytes > MAX_TOTAL_BYTES) {
        setUploadError("This group is over the 10 GB session limit. Please send it in two contributions.");
        return current;
      }
      setUploadError("");
      return combined;
    });
    event.target.value = "";
  }

  function removeFile(id: string) {
    if (uploading) return;
    setFiles(current => current.filter(item => item.id !== id));
    setProgress(current => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError("");
    setUploading(true);
    setActiveFile(files.length ? "Preparing secure upload…" : "Saving your written memory…");
    setProgress({});

    try {
      const form = new FormData(event.currentTarget);
      const payload = {
        name: String(form.get("name") ?? ""),
        contact: String(form.get("contact") ?? ""),
        relationship: String(form.get("relationship") ?? "Other"),
        firstMemory,
        story: String(form.get("story") ?? ""),
        approximateYear: String(form.get("year") ?? ""),
        place: String(form.get("place") ?? ""),
        people: String(form.get("people") ?? ""),
        lifeChapter: String(form.get("chapter") ?? "Not sure"),
        prompt: String(form.get("prompt") ?? ""),
        consent: Boolean(form.get("consent")),
        files: files.map(item => ({
          name: item.file.name,
          type: normalizedFileType(item.file),
          size: item.file.size
        }))
      };

      const prepareResponse = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) throw new Error(prepared.error || "Could not prepare the upload.");

      const completedFiles: CompletedFile[] = [];
      for (let index = 0; index < prepared.uploads.length; index += 1) {
        const target = prepared.uploads[index] as PreparedUpload;
        const selected = files[index];
        if (!selected) throw new Error("A selected file could not be matched.");

        setActiveFile(`Uploading ${index + 1} of ${files.length}: ${selected.file.name}`);
        const blob = await uploadWithRetry(target, selected, percentage => {
          setProgress(current => ({ ...current, [selected.id]: percentage }));
        });

        completedFiles.push({
          ...blob,
          originalName: selected.file.name,
          bytes: selected.file.size,
          contentType: normalizedFileType(selected.file)
        });
        setProgress(current => ({ ...current, [selected.id]: 100 }));
      }

      setActiveFile("Verifying that everything arrived…");
      const completeResponse = await fetch("/api/submissions/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: prepared.submissionId, files: completedFiles })
      });
      const completed = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completed.error || "Could not confirm the upload.");

      setConfirmationId(String(completed.submissionId ?? prepared.submissionId));
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "The upload could not be completed.";
      setUploadError(`${reason} Your form and selected files are still here. Check your connection and try again, or email the files to uploads@sandi50th.com.`);
    } finally {
      setUploading(false);
      setActiveFile("");
    }
  }

  if (submitted) {
    return (
      <section className="contributionSuccess" aria-live="polite">
        <span className="successMark">✓</span>
        <span className="eyebrow">YOUR MEMORY ARRIVED</span>
        <h2>Thank you for becoming part of Sandi’s story.</h2>
        <p>
          Your written memory and {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} have` : "details have"} been received and verified in private storage.
        </p>
        <p className="confirmationCode">Confirmation: {confirmationId.slice(0, 8).toUpperCase()}</p>
        <button className="secondary" type="button" onClick={() => window.location.reload()}>
          Share another memory
        </button>
      </section>
    );
  }

  return (
    <form className="memoryForm" onSubmit={submit}>
      <section className="memoryOpening panel">
        <span className="eyebrow">BEGIN WITH THE STORY</span>
        <label className="openingQuestion">
          When you think of Sandi, what is the first memory that comes to mind?
          <textarea
            rows={6}
            value={firstMemory}
            onChange={event => setFirstMemory(event.target.value)}
            placeholder="Do not worry about writing beautifully. Tell us what happened, where you were, and why you still remember it."
            required
          />
        </label>
        {!opened && (
          <button
            type="button"
            className="primary"
            disabled={!firstMemory.trim()}
            onClick={() => setOpened(true)}
          >
            Continue the story
          </button>
        )}
      </section>

      {opened && (
        <div className="contributionColumns">
          <section className="panel formDetails">
            <span className="eyebrow">THE DETAILS BEHIND THE MEMORY</span>
            <div className="grid2 contributionGrid">
              <label>Your name<input name="name" required placeholder="How Sandi knows you" /></label>
              <label>Email or phone<input name="contact" required placeholder="For project updates only" /></label>
              <label>Your relationship to Sandi
                <select name="relationship" defaultValue="Friend">
                  <option>Family</option><option>Friend</option><option>Childhood friend</option><option>College friend</option><option>Colleague</option><option>Neighbor</option><option>Other</option>
                </select>
              </label>
              <label>Approximate year<input name="year" placeholder="Example: 1988 or early 2000s" /></label>
              <label>Where did this happen?<input name="place" placeholder="Roslyn, Boston, England, a family trip…" /></label>
              <label>Who appears in it?<input name="people" placeholder="Names, if known" /></label>
            </div>

            <label>Where does this belong in her story?
              <select name="chapter" defaultValue="Not sure">
                {chapters.map(chapter => <option key={chapter}>{chapter}</option>)}
              </select>
            </label>

            <label>Choose a prompt for your birthday message
              <select name="prompt">{prompts.map(prompt => <option key={prompt}>{prompt}</option>)}</select>
            </label>

            <label>The fuller story
              <textarea name="story" rows={5} placeholder="Add details, an inside joke, what happened before or after, or why the memory matters." />
            </label>

            <div className="uploadBox">
              <span className="uploadGlyph">↑</span>
              <h3>Share photographs, video, audio, or keepsakes</h3>
              <p>Choose up to twenty items at once. iPhone HEIC photos are welcome. Large videos use a multipart transfer so a failed part can retry without starting the whole video again.</p>
              <label className="filePicker primary">
                Choose files
                <input type="file" multiple accept="image/*,video/*,audio/*,.heic,.heif,.pdf" onChange={addFiles} />
              </label>
            </div>

            {files.length > 0 && (
              <div className="selectedFiles">
                <div className="fileSummary"><strong>{files.length} item{files.length === 1 ? "" : "s"}</strong><span>{formatBytes(totalSize)} selected</span></div>
                {files.map(item => (
                  <article key={item.id}>
                    <span className="fileType">{mediaType(normalizedFileType(item.file))}</span>
                    <div>
                      <strong>{item.file.name}</strong>
                      <small>{progress[item.id] !== undefined ? `${Math.round(progress[item.id])}% · ` : ""}{formatBytes(item.file.size)}</small>
                    </div>
                    <button type="button" disabled={uploading} aria-label={`Remove ${item.file.name}`} onClick={() => removeFile(item.id)}>×</button>
                  </article>
                ))}
              </div>
            )}

            <label className="consent contributionConsent">
              <input name="consent" type="checkbox" required />
              <span>I have permission to share these materials in Sandi’s private birthday film and archive.</span>
            </label>

            {uploading && (
              <div className="uploadProgress" role="status" aria-live="polite">
                <span style={{ width: `${totalProgress}%` }} />
                <p>{activeFile} {files.length ? `${Math.round(totalProgress)}%` : ""}</p>
              </div>
            )}
            {uploadError && (
              <div className="uploadError" role="alert">
                <strong>The contribution has not been confirmed yet.</strong>
                <p>{uploadError}</p>
                <a href={EMAIL_FALLBACK}>Email the memory instead</a>
              </div>
            )}
            <button className="primary submitMemory" type="submit" disabled={uploading}>
              {uploading ? "Please keep this page open…" : uploadError ? "Try the upload again" : "Send my contribution securely"}
            </button>
            <p className="secureNote">Files go directly from this device to private storage. Keep this page open until the confirmation code appears.</p>
            <p className="uploadFallback">If uploading does not work, email the files to <a href={EMAIL_FALLBACK}>uploads@sandi50th.com</a> with your name and a short note about the memory. Do not delete the originals from your phone.</p>
          </section>

          <aside className="panel contributionGuide">
            <span className="eyebrow">WHAT WE HOPE YOU WILL FIND</span>
            <h2>Look beyond your camera roll.</h2>
            <ul>
              <li>Baby and childhood photographs of Sandi</li>
              <li>Roslyn school pictures and home movies</li>
              <li>Boston University and England memories</li>
              <li>Old family holidays and funny candid moments</li>
              <li>Oracle photographs, awards, and colleague stories</li>
              <li>Letters, cards, drawings, invitations, or keepsakes</li>
              <li>A personal 30–120 second birthday message</li>
            </ul>
            <div className="recordingTip">
              <span>For a beautiful video</span>
              <p>Face a window, hold the phone horizontally, keep it steady, and pause for two seconds before and after speaking.</p>
            </div>
            <p className="helpAddress">Need help?<br/><a href={EMAIL_FALLBACK}>uploads@sandi50th.com</a></p>
          </aside>
        </div>
      )}
    </form>
  );
}

async function uploadWithRetry(
  target: PreparedUpload,
  selected: SelectedFile,
  onProgress: (percentage: number) => void
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await upload(target.pathname, selected.file, {
        access: "private",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({
          submissionId: target.pathname.split("/")[1],
          originalName: selected.file.name,
          bytes: selected.file.size
        }),
        contentType: normalizedFileType(selected.file),
        multipart: selected.file.size >= MULTIPART_THRESHOLD,
        onUploadProgress: event => onProgress(event.percentage)
      });
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise(resolve => window.setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${selected.file.name} could not be uploaded after three attempts.`);
}

function normalizedFileType(file: File) {
  if (file.type) return file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".m4a")) return "audio/x-m4a";
  if (name.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function mediaType(type: string) {
  if (type.startsWith("image")) return "PHOTO";
  if (type.startsWith("video")) return "VIDEO";
  if (type.startsWith("audio")) return "AUDIO";
  return "FILE";
}
