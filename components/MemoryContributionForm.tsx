"use client";

import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import { PostUploadPhotoReview } from "@/components/PostUploadPhotoReview";
import { fireContributionConfetti } from "@/lib/confetti";
import { fireContributionBalloons } from "@/lib/balloons";
import { NameChorusRecorder } from "@/components/NameChorusRecorder";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

const MAX_FILES = 500;
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024 * 1024;
const MULTIPART_THRESHOLD = 8 * 1024 * 1024;
const PARALLEL_UPLOADS = 1;
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

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type UploadStatus = "ready" | "uploading" | "uploaded" | "failed";
type SelectedFile = {
  file: File;
  id: string;
  relativePath: string;
  preview: string;
  status: UploadStatus;
  error: string;
};
type PreparedUpload = { pathname: string; name: string; type: string; size: number };
type PreparedBatch = { submissionId: string; duplicateReviewToken: string | null; targets: Record<string, PreparedUpload> };
type CompletedFile = PutBlobResult & { originalName: string; bytes: number };
type LegacyEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (success: (file: File) => void, failure?: (error: DOMException) => void) => void;
  createReader?: () => {
    readEntries: (success: (entries: LegacyEntry[]) => void, failure?: (error: DOMException) => void) => void;
  };
};

export function MemoryContributionForm({
  mode = "contributor",
  initialChapter,
  startWithUpload = false,
  onSkipToPhotos
}: {
  mode?: "contributor" | "ownerArchive";
  initialChapter?: string;
  startWithUpload?: boolean;
  onSkipToPhotos?: () => void;
}) {
  const ownerArchive = mode === "ownerArchive";
  const [firstMemory, setFirstMemory] = useState(ownerArchive ? "Owner archive batch" : "");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [inputMode, setInputMode] = useState<"type" | "speak">("type");
  const [speechNotice, setSpeechNotice] = useState("");
  const [listening, setListening] = useState(false);
  const [speechDraft, setSpeechDraft] = useState("");
  const [speechError, setSpeechError] = useState("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [confirmationId, setConfirmationId] = useState("");
  const [contributorName, setContributorName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeFile, setActiveFile] = useState("");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [uploadError, setUploadError] = useState("");
  const [batch, setBatch] = useState<PreparedBatch | null>(null);
  const [dragging, setDragging] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);
  const completed = useRef<Record<string, CompletedFile>>({});
  const extracted = useRef<Record<string, CompletedFile>>({});
  const celebrated = useRef(false);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);
  const speechRecorder = useRef<MediaRecorder | null>(null);
  const speechStream = useRef<MediaStream | null>(null);
  const speechChunks = useRef<Blob[]>([]);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setSpeechSupported(Boolean(
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition ||
      (typeof navigator.mediaDevices?.getUserMedia === "function" && typeof MediaRecorder !== "undefined")
    ));
    return () => {
      speechRecognition.current?.stop();
      if (speechRecorder.current?.state === "recording") speechRecorder.current.stop();
      speechStream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  function stopDictation() {
    speechRecognition.current?.stop();
    if (speechRecorder.current?.state === "recording") {
      // Safari can deliver its final MP4/AAC chunk asynchronously. Ask for it
      // before stopping and leave the tracks alive until onstop has run.
      try { speechRecorder.current.requestData(); } catch { /* optional in older browsers */ }
      speechRecorder.current.stop();
    }
    setListening(false);
    setSpeechDraft("");
  }

  async function toggleDictation() {
    if (listening) {
      stopDictation();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setSpeechError("This browser cannot record inside the page. Choose Record your voice above to use the phone recorder or upload a Voice Memos file.");
      return;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = chooseSpeechMimeType();
      const recorder = mimeType ? new MediaRecorder(media, { mimeType }) : new MediaRecorder(media);
      speechStream.current = media;
      speechRecorder.current = recorder;
      speechChunks.current = [];
      recorder.ondataavailable = event => { if (event.data.size) speechChunks.current.push(event.data); };
      recorder.onstop = () => {
        // Safari reports audio/mp4 with a codec parameter. Canonicalize it so
        // the Blob, File, validator, and upload request all agree.
        const type = normalizedMimeType(recorder.mimeType || mimeType || "audio/webm");
        const blob = new Blob(speechChunks.current, { type });
        if (blob.size) {
          const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
          const file = new File([blob], `spoken-memory-${Date.now()}.${extension}`, { type, lastModified: Date.now() });
          addIncoming([file]);
          setFirstMemory(current => current.trim() || "Voice memory recorded for Sandi. Please edit this sentence if the live transcript did not appear.");
          setSpeechNotice("Your original voice recording is attached and will be kept with Sandi's story. You can edit the words above before continuing.");
        }
        speechChunks.current = [];
        speechRecorder.current = null;
        speechStream.current?.getTracks().forEach(track => track.stop());
        speechStream.current = null;
      };
      recorder.start(500);

      const speechWindow = window as SpeechWindow;
      const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
      if (Recognition) {
        const recognition = new Recognition();
        const startingText = firstMemory.trim();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.onresult = event => {
          let finished = "";
          let interim = "";
          for (let index = 0; index < event.results.length; index += 1) {
            const words = event.results[index][0]?.transcript ?? "";
            if (event.results[index].isFinal) finished += words + " ";
            else interim += words;
          }
          setFirstMemory([startingText, finished.trim()].filter(Boolean).join(" "));
          setSpeechDraft(interim.trim());
        };
        recognition.onerror = event => {
          setSpeechNotice(event.error === "not-allowed"
            ? "Live transcription was blocked, but your original audio is still recording. Keep speaking, then edit the text before continuing."
            : "Live transcription paused, but your original audio is still recording safely. Keep speaking and tap Stop when finished.");
          setSpeechDraft("");
        };
        recognition.onend = () => { speechRecognition.current = null; setSpeechDraft(""); };
        speechRecognition.current = recognition;
        try { recognition.start(); } catch { setSpeechNotice("Your voice is recording. Live words are unavailable here, so you can edit the text after stopping."); }
      } else {
        setSpeechNotice("Your voice is recording. Live words are unavailable in this browser, so you can edit the text after stopping.");
      }

      setSpeechError("");
      setListening(true);
    } catch (cause) {
      setSpeechError(cause instanceof DOMException && (cause.name === "NotAllowedError" || cause.name === "SecurityError")
        ? "Microphone access was blocked. Choose Allow when the browser asks, or use Record your voice above to open the phone recorder."
        : "The microphone could not open. Use Record your voice above; the phone recorder and existing Voice Memos files are accepted.");
      setListening(false);
    }
  }
  useEffect(() => {
    if (!submitted || celebrated.current) return;
    celebrated.current = true;
    fireContributionConfetti();
    fireContributionBalloons();
  }, [submitted]);

  useEffect(() => {
    const input = folderInput.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
  }, []);

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

  function addIncoming(incoming: File[]) {
    const accepted: SelectedFile[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      const relativePath = file.webkitRelativePath || file.name;
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(file.name + " is larger than the 5 GB per-file limit");
        continue;
      }
      if (!isAcceptedType(file)) {
        rejected.push(file.name + " is not a supported photo, video, audio, ZIP, or PDF");
        continue;
      }
      const id = [relativePath, file.size, file.lastModified].join("-");
      accepted.push({
        file,
        id,
        relativePath,
        preview: canPreview(file) ? URL.createObjectURL(file) : "",
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
      const combinedBytes = combined.reduce((sum, item) => sum + item.file.size, 0);
      if (combinedBytes > MAX_TOTAL_BYTES) {
        for (const item of added) if (item.preview) URL.revokeObjectURL(item.preview);
        setUploadError("This album is over the 10 GB session limit. Please send it in two contributions.");
        return current;
      }
      const warnings = [...rejected];
      if (unique.length > room) warnings.push("Only the first " + MAX_FILES + " items were selected");
      setUploadError(warnings.length ? warnings.join(". ") + "." : "");
      return combined;
    });
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    addIncoming(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  async function dropFiles(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const items = Array.from(event.dataTransfer.items ?? []);
    const entries: LegacyEntry[] = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) entries.push(entry as unknown as LegacyEntry);
    }

    if (entries.length) {
      const collected: File[] = [];
      for (const entry of entries) collected.push(...await filesFromEntry(entry, ""));
      addIncoming(collected);
      return;
    }
    addIncoming(Array.from(event.dataTransfer.files));
  }

  function removeFile(id: string) {
    if (uploading || batch) return;
    setFiles(current => {
      const removed = current.find(item => item.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return current.filter(item => item.id !== id);
    });
    setProgress(current => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function updateFile(id: string, update: Partial<Pick<SelectedFile, "status" | "error">>) {
    setFiles(current => current.map(item => item.id === id ? { ...item, ...update } : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedForm = new FormData(event.currentTarget);
    const fullerStory = String(submittedForm.get("story") ?? "").trim();
    if (!ownerArchive && !firstMemory.trim() && !fullerStory && !files.length) {
      setUploadError("Add at least one thing before sending: a memory, photograph, video, or voice recording.");
      return;
    }
    if (startWithUpload && !files.length) {
      setUploadError("Choose at least one photograph or video before sending.");
      return;
    }
    if (batch) {
      await runBatch(batch);
      return;
    }

    setUploadError("");
    setUploading(true);
    setActiveFile(files.length ? "Preparing your private album…" : "Saving your written memory…");
    setProgress({});

    try {
      const form = submittedForm;
      const payload = {
        sourceType: ownerArchive ? "owner_archive" : "contributor",
        name: ownerArchive ? "Owner archive" : String(form.get("name") ?? ""),
        contact: ownerArchive ? "Private owner import" : String(form.get("contact") ?? ""),
        relationship: ownerArchive ? "Owner archive" : String(form.get("relationship") ?? "Other"),
        firstMemory: ownerArchive ? "Owner archive batch" : firstMemory.trim() || "Photographs or video shared for Sandi's birthday story.",
        story: String(form.get("story") ?? ""),
        approximateYear: String(form.get("year") ?? ""),
        place: String(form.get("place") ?? ""),
        people: String(form.get("people") ?? ""),
        lifeChapter: String(form.get("chapter") ?? "Not sure"),
        prompt: ownerArchive ? "OWNER_ARCHIVE" : String(form.get("prompt") ?? ""),
        consent: ownerArchive || Boolean(form.get("consent")),
        files: files.map(item => ({
          name: item.relativePath,
          type: normalizedFileType(item.file),
          size: item.file.size
        }))
      };
      setContributorName(payload.name);

      const prepareResponse = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) throw new Error(prepared.error || "Could not prepare the upload.");

      const nextBatch: PreparedBatch = {
        submissionId: String(prepared.submissionId),
        duplicateReviewToken: typeof prepared.duplicateReviewToken === "string" ? prepared.duplicateReviewToken : null,
        targets: Object.fromEntries(files.map((item, index) => [item.id, prepared.uploads[index] as PreparedUpload]))
      };
      setBatch(nextBatch);
      setUploading(false);
      await runBatch(nextBatch);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "The upload could not be prepared.";
      setUploadError(reason + " Your form and selected files are still here. Try again, or email the files to uploads@sandi50th.com.");
      setUploading(false);
      setActiveFile("");
    }
  }

  async function runBatch(currentBatch: PreparedBatch) {
    setUploading(true);
    setUploadError("");
    const pending = files.filter(item => !completed.current[item.id]);
    let cursor = 0;
    let failed = 0;

    async function worker() {
      while (cursor < pending.length) {
        const index = cursor;
        cursor += 1;
        const selected = pending[index];
        const target = currentBatch.targets[selected.id];
        if (!target) {
          failed += 1;
          updateFile(selected.id, { status: "failed", error: "This file lost its upload destination. Please email it instead." });
          continue;
        }
        updateFile(selected.id, { status: "uploading", error: "" });
        setActiveFile("Uploading " + selected.file.name);
        try {
          const blob = await uploadWithRetry(currentBatch.submissionId, target, selected, percentage => {
            setProgress(current => ({ ...current, [selected.id]: percentage }));
          });
          const saved: CompletedFile = {
            ...blob,
            originalName: selected.relativePath,
            bytes: selected.file.size,
            contentType: normalizedFileType(selected.file)
          };
          completed.current[selected.id] = saved;
          setProgress(current => ({ ...current, [selected.id]: 100 }));
          updateFile(selected.id, { status: "uploaded", error: "" });

          if (isZip(selected.file)) {
            setActiveFile("Sorting " + selected.file.name + " into individual memories…");
            const unpackedResponse = await fetch("/api/submissions/unpack", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                submissionId: currentBatch.submissionId,
                pathname: blob.pathname,
                originalName: selected.file.name
              })
            });
            const unpacked = await unpackedResponse.json();
            if (unpackedResponse.ok && Array.isArray(unpacked.extracted)) {
              for (const item of unpacked.extracted as CompletedFile[]) {
                extracted.current[item.pathname] = item;
              }
            }
          }
        } catch (error) {
          failed += 1;
          const reason = error instanceof Error ? error.message : "Upload failed";
          updateFile(selected.id, { status: "failed", error: reason });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, Math.max(1, pending.length)) }, worker));

    const savedFiles = [...Object.values(completed.current), ...Object.values(extracted.current)];
    if (savedFiles.length || files.length === 0) {
      try {
        setActiveFile("Verifying and backing up what arrived…");
        const response = await fetch("/api/submissions/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId: currentBatch.submissionId, files: savedFiles })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not verify the saved files.");
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Confirmation failed.";
        setUploadError(reason + " Do not delete the originals; email uploads@sandi50th.com so we can verify them.");
        setUploading(false);
        setActiveFile("");
        return;
      }
    }

    const remaining = files.filter(item => !completed.current[item.id]).length;
    if (!remaining && failed === 0) {
      setConfirmationId(currentBatch.submissionId);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setUploadError(
        Object.keys(completed.current).length + " item(s) arrived safely. " +
        remaining + " did not finish. The successful files will not be sent again; use Retry failed files."
      );
    }
    setUploading(false);
    setActiveFile("");
  }

  if (submitted) {
    return (
      <section className="contributionSuccess" aria-live="polite">
        <span className="successMark">✓</span>
        <span className="eyebrow">{ownerArchive ? "OWNER ARCHIVE SAVED" : "YOUR MEMORY ARRIVED"}</span>
        <h2>{ownerArchive ? "The archive batch is safely stored." : "Thank you for becoming part of Sandi’s story."}</h2>
        <p>
          Your written memory and {files.length ? files.length + " file" + (files.length === 1 ? " has" : "s have") : "details have"} been received, verified, and backed up in private storage.
        </p>
        <p className="confirmationCode">Confirmation: {confirmationId.slice(0, 8).toUpperCase()}</p>
        {!ownerArchive && <NameChorusRecorder submissionId={confirmationId} contributorName={contributorName} />}
        <PostUploadPhotoReview submissionId={confirmationId} reviewToken={batch?.duplicateReviewToken ?? null} />
        <button className="secondary" type="button" onClick={() => window.location.reload()}>
          Share another memory
        </button>
      </section>
    );
  }

  const failedCount = files.filter(item => item.status === "failed").length;

  return (
    <form className={"memoryForm" + (ownerArchive ? " ownerArchiveForm" : startWithUpload ? " photoOnlyForm" : "")} onSubmit={submit}>
      {ownerArchive && <div className="panel ownerArchiveNotice"><span className="eyebrow">OWNER ARCHIVE</span><h2>Import Sandi’s private archive</h2><p>These photographs are labeled separately from contributions and deduplicated by their file contents.</p></div>}
      {!ownerArchive && !startWithUpload && <section className="memoryOpening panel">
        <span className="eyebrow">WRITE OR SPEAK — OPTIONAL</span>
        <label className="openingQuestion">
          <span>When you think of Sandi, what is the first memory that comes to mind?</span>
          <small className="memoryInstruction" id="memory-instruction">Write if you want to. You can leave this blank and send only photos, video, or a voice recording.</small>
          <div className="memoryInputModes" role="group" aria-label="Choose how to add your memory">
            <button type="button" aria-pressed={inputMode === "type"} onClick={() => { if (listening) stopDictation(); setInputMode("type"); }}>Type</button>
            <button type="button" aria-pressed={inputMode === "speak"} onClick={() => setInputMode("speak")}>Speak</button>
          </div>
          <textarea
            rows={6}
            value={firstMemory}
            onChange={event => setFirstMemory(event.target.value)}
            placeholder={inputMode === "speak" ? "Your spoken words will appear here. You can correct names before sending." : "Tell us what happened, where you were, or why you remember it."}
            aria-describedby="memory-instruction"
          />
          {inputMode === "speak" && speechSupported && (
            <button type="button" className="memoryMic" aria-pressed={listening} onClick={toggleDictation}>
              <span aria-hidden="true">{listening ? "Stop" : "Mic"}</span>
              {listening ? "Stop and attach my recording" : "Tap to speak instead of typing"}
            </button>
          )}
          {inputMode === "speak" && !speechSupported && <small className="speechError">This browser cannot record here. Choose Record your voice at the top to use the phone recorder or a Voice Memos file.</small>}
          {listening && <small className="speechStatus" role="status">Recording your original voice now. {speechDraft && <em>{speechDraft}</em>}</small>}
          {speechNotice && <small className="speechNotice" role="status">{speechNotice}</small>}
          {speechError && <small className="speechError" role="alert">{speechError}</small>}
        </label>
      </section>}

      {(
        <div className="contributionColumns">
          <section className="panel formDetails">
            <span className="eyebrow">{ownerArchive ? "OWNER ARCHIVE DETAILS" : "ADD ANYTHING YOU WANT — ALL ON THIS PAGE"}</span>
            <div className="grid2 contributionGrid">
              <label>Your name<input name="name" required defaultValue={ownerArchive ? "Owner archive" : undefined} placeholder="How Sandi knows you" /></label>
              <label>Email or phone<input name="contact" required defaultValue={ownerArchive ? "Private owner import" : undefined} placeholder="For project updates only" /></label>
              <label>Your relationship to Sandi
                <select name="relationship" defaultValue={ownerArchive ? "Other" : "Friend"}>
                  <option>Family</option><option>Friend</option><option>Childhood friend</option><option>College friend</option><option>Colleague</option><option>Neighbor</option><option>Other</option>
                </select>
              </label>
              <label>Approximate year<input name="year" placeholder="Example: 1988 or early 2000s" /></label>
              <label>Where did this happen?<input name="place" placeholder="Roslyn, Boston, England, a family trip…" /></label>
              <label>Who appears in it?<input name="people" placeholder="Names, if known" /></label>
            </div>

            <label>Where does this belong in her story?
              <select name="chapter" defaultValue={ownerArchive ? "Not sure" : initialChapter ?? "Not sure"}>
                {chapters.map(chapter => <option key={chapter}>{chapter}</option>)}
              </select>
            </label>

            {!startWithUpload && <>
              <label>Choose a prompt for your birthday message
                <select name="prompt">{prompts.map(prompt => <option key={prompt}>{prompt}</option>)}</select>
              </label>
              <label>The fuller story
                <textarea name="story" rows={5} placeholder="Add details, an inside joke, what happened before or after, or why the memory matters." />
              </label>
            </>}

            <div
              className={"uploadBox albumDrop " + (dragging ? "isDragging" : "")}
              onDragEnter={event => { event.preventDefault(); setDragging(true); }}
              onDragOver={event => event.preventDefault()}
              onDragLeave={event => { if (event.currentTarget === event.target) setDragging(false); }}
              onDrop={dropFiles}
            >
              <span className="uploadGlyph">↑</span>
              <h3>Drop an entire album — we’ll sort it out.</h3>
              <p>Select many files from your phone, choose a whole folder on a computer, or send a ZIP with nested folders. Nothing needs organizing or captioning first.</p>
              <div className="albumActions">
                <label className="filePicker primary">
                  Choose photos and videos
                  <input type="file" multiple accept="image/*,video/*,audio/*,.heic,.heif,.pdf,.zip,application/zip" onChange={chooseFiles} />
                </label>
                <label className="filePicker secondary recordPicker">
                  Record your voice
                  <input type="file" accept="audio/*" capture onChange={chooseFiles} />
                </label>
                <label className="filePicker secondary recordPicker">
                  Record a birthday video
                  <input type="file" accept="video/*" capture="user" onChange={chooseFiles} />
                </label>
                <label className="filePicker secondary folderPicker">
                  Choose a folder
                  <input ref={folderInput} type="file" multiple onChange={chooseFiles} />
                </label>
              </div>
              <small>Up to {MAX_FILES} items, 5 GB per file, 10 GB per contribution. Large videos upload in resumable parts.</small>
            </div>

            {files.length > 0 && (
              <div className="selectedFiles albumSelection">
                <div className="fileSummary">
                  <strong>{files.length} item{files.length === 1 ? "" : "s"}</strong>
                  <span>{formatBytes(totalSize)} selected · duplicates in this batch are skipped</span>
                </div>
                <div className="thumbnailGrid">
                  {files.map(item => (
                    <article key={item.id} className={"uploadTile status-" + item.status}>
                      <div className="uploadThumb">
                        <UploadThumbnail item={item} />
                      </div>
                      <div className="uploadTileCopy">
                        <strong title={item.relativePath}>{item.relativePath}</strong>
                        <small>{item.status === "failed" ? "Needs retry" : item.status === "uploaded" ? "Saved" : progress[item.id] !== undefined ? Math.round(progress[item.id]) + "%" : formatBytes(item.file.size)}</small>
                        {item.error && <small className="tileError">{item.error}</small>}
                      </div>
                      <button type="button" disabled={uploading || Boolean(batch)} aria-label={"Remove " + item.file.name} onClick={() => removeFile(item.id)}>×</button>
                      <span className="tileProgress" style={{ width: (progress[item.id] ?? 0) + "%" }} />
                    </article>
                  ))}
                </div>
              </div>
            )}

            <label className="consent contributionConsent">
              <input name="consent" type="checkbox" required defaultChecked={ownerArchive} />
              <span>I have permission to share these materials in Sandi’s private birthday film and archive.</span>
            </label>

            {uploading && (
              <div className="uploadProgress" role="status" aria-live="polite">
                <span style={{ width: totalProgress + "%" }} />
                <p>{activeFile} {files.length ? Math.round(totalProgress) + "%" : ""}</p>
              </div>
            )}
            {uploadError && (
              <div className="uploadError" role="alert">
                <strong>{failedCount ? "Part of the album needs another try." : "The contribution has not been confirmed yet."}</strong>
                <p>{uploadError}</p>
                <a href={EMAIL_FALLBACK}>Email the memory instead</a>
              </div>
            )}
            <button className="primary submitMemory" type="submit" disabled={uploading}>
              {uploading ? "Please keep this page open…" : failedCount ? "Retry failed files" : "Send everything securely"}
            </button>
            <p className="secureNote">Files go directly from this device to private storage, three at a time. If one fails, the others remain saved and only that file needs retrying.</p>
            <p className="uploadFallback">If uploading does not work, email the files to <a href={EMAIL_FALLBACK}>uploads@sandi50th.com</a> with your name and a short note. Do not delete the originals from your phone.</p>
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
  submissionId: string,
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
          submissionId,
          originalName: selected.relativePath,
          bytes: selected.file.size,
          contentType: normalizedFileType(selected.file)
        }),
        contentType: normalizedFileType(selected.file),
        multipart: normalizedFileType(selected.file).startsWith("video/") || selected.file.size >= MULTIPART_THRESHOLD,
        onUploadProgress: event => onProgress(event.percentage)
      });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => window.setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(selected.file.name + " could not be uploaded after three attempts.");
}

async function filesFromEntry(entry: LegacyEntry, parent: string): Promise<File[]> {
  const path = parent ? parent + "/" + entry.name : entry.name;
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => entry.file?.(resolve, reject));
    Object.defineProperty(file, "webkitRelativePath", { value: path, configurable: true });
    return [file];
  }
  if (!entry.isDirectory || !entry.createReader) return [];

  const reader = entry.createReader();
  const children: LegacyEntry[] = [];
  while (true) {
    const page = await new Promise<LegacyEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (!page.length) break;
    children.push(...page);
  }
  const nested: File[] = [];
  for (const child of children) nested.push(...await filesFromEntry(child, path));
  return nested;
}

function normalizedFileType(file: File) {
  if (file.type) {
    const type = normalizedMimeType(file.type);
    if (type === "application/x-zip-compressed") return type;
    return type;
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".m4v")) return "video/x-m4v";
  if (name.endsWith(".3gp")) return "video/3gpp";
  if (name.endsWith(".3g2")) return "video/3gpp2";
  if (name.endsWith(".m4a")) return "audio/x-m4a";
  if (name.endsWith(".caf")) return "audio/x-caf";
  if (name.endsWith(".aac")) return "audio/aac";
  if (name.endsWith(".mp3")) return "audio/mpeg";
  if (name.endsWith(".wav")) return "audio/wav";
  if (name.endsWith(".zip")) return "application/zip";
  if (name.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function normalizedMimeType(value: string) {
  return value.toLowerCase().split(";", 1)[0].trim();
}

function isAcceptedType(file: File) {
  const type = normalizedFileType(file);
  return type.startsWith("image/") || type.startsWith("video/") || type.startsWith("audio/") ||
    type === "application/pdf" || type === "application/zip" || type === "application/x-zip-compressed";
}

function isZip(file: File) {
  return /\.zip$/i.test(file.name) || normalizedFileType(file).includes("zip");
}

function canPreview(file: File) {
  const type = normalizedFileType(file);
  // Safari 17+ can display an iPhone HEIC selection directly. Other browsers
  // still preserve and upload the original even when they cannot preview it.
  return type.startsWith("image/") || type.startsWith("video/");
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / 1024 ** index).toFixed(index ? 1 : 0) + " " + units[index];
}

function mediaType(type: string) {
  if (type.startsWith("image")) return "PHOTO";
  if (type.startsWith("video")) return "VIDEO";
  if (type.startsWith("audio")) return "AUDIO";
  return "FILE";
}


function UploadThumbnail({ item }: { item: SelectedFile }) {
  const [failed, setFailed] = useState(false);
  if (!item.preview || failed) {
    return <span>{isZip(item.file) ? "ZIP" : mediaType(normalizedFileType(item.file))}</span>;
  }
  if (normalizedFileType(item.file).startsWith("video/")) {
    return <video src={item.preview} muted playsInline onError={() => setFailed(true)} />;
  }
  return <img src={item.preview} alt="" onError={() => setFailed(true)} />;
}

function chooseSpeechMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"]
    .find(type => MediaRecorder.isTypeSupported(type)) || "";
}