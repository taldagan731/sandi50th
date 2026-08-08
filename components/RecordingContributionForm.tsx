"use client";

import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import { fireContributionConfetti } from "@/lib/confetti";
import { NameChorusRecorder } from "@/components/NameChorusRecorder";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

const EMAIL_FALLBACK = "mailto:uploads@sandi50th.com?subject=Sandi%2050th%20recording";
const MAX_BYTES = 5 * 1024 * 1024 * 1024;
const MULTIPART_THRESHOLD = 100 * 1024 * 1024;

type RecordingKind = "voice" | "birthday";
type CaptureKind = "audio" | "video";
type PreparedUpload = { pathname: string; name: string; type: string; size: number };
type CompletedFile = PutBlobResult & { originalName: string; bytes: number };

export function RecordingContributionForm({ kind }: { kind: RecordingKind }) {
  const [captureKind, setCaptureKind] = useState<CaptureKind>("audio");
  const [phase, setPhase] = useState<"idle" | "requesting" | "recording" | "preview" | "uploading" | "success">("idle");
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [contributorName, setContributorName] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const liveVideo = useRef<HTMLVideoElement>(null);
  const timer = useRef<number | null>(null);
  const celebrated = useRef(false);

  const birthday = kind === "birthday";
  const effectiveKind: CaptureKind = birthday ? captureKind : "audio";

  useEffect(() => {
    if (phase !== "success" || celebrated.current) return;
    celebrated.current = true;
    fireContributionConfetti();
  }, [phase]);

  useEffect(() => {
    return () => {
      stream.current?.getTracks().forEach(track => track.stop());
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  useEffect(() => {
    if (phase === "recording" && liveVideo.current && stream.current) {
      liveVideo.current.srcObject = stream.current;
    }
  }, [phase]);

  async function beginRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Direct recording is not supported by this browser. Choose a recording made with the Camera or Voice Memos app instead.");
      setPhase("idle");
      return;
    }
    setPhase("requesting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: effectiveKind === "video"
          ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
          : false
      });
      stream.current = media;
      if (liveVideo.current) liveVideo.current.srcObject = media;

      const mimeType = chooseMimeType(effectiveKind);
      const nextRecorder = mimeType ? new MediaRecorder(media, { mimeType }) : new MediaRecorder(media);
      recorder.current = nextRecorder;
      chunks.current = [];
      nextRecorder.ondataavailable = event => {
        if (event.data.size) chunks.current.push(event.data);
      };
      nextRecorder.onerror = () => {
        setError("Recording stopped unexpectedly. Your browser can still upload a recording made with the Camera or Voice Memos app.");
        stopTracks();
        setPhase("idle");
      };
      nextRecorder.onstop = () => {
        const type = nextRecorder.mimeType || mimeType || (effectiveKind === "video" ? "video/webm" : "audio/webm");
        const blob = new Blob(chunks.current, { type });
        const extension = extensionFor(type, effectiveKind);
        const file = new File([blob], (birthday ? "birthday-message" : "voice-memory") + "-" + Date.now() + "." + extension, {
          type,
          lastModified: Date.now()
        });
        setRecordingFile(file);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(file));
        stopTracks();
        setPhase("preview");
      };
      nextRecorder.start(1000);
      setSeconds(0);
      timer.current = window.setInterval(() => setSeconds(value => value + 1), 1000);
      setPhase("recording");
    } catch (cause) {
      console.error("media-recorder-start", cause);
      setError("Camera or microphone access was not available. You can still choose a recording from this phone.");
      stopTracks();
      setPhase("idle");
    }
  }

  function stopRecording() {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function recordAgain() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setRecordingFile(null);
    setSeconds(0);
    setError("");
    setPhase("idle");
  }

  function chooseFallback(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("That recording is over the 5 GB limit. Email uploads@sandi50th.com and we will arrange another transfer.");
      return;
    }
    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      setError("Please choose an audio or video recording.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (birthday) setCaptureKind(isVideoFile(file) ? "video" : "audio");
    setRecordingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setSeconds(0);
    setError("");
    setPhase("preview");
  }

  async function submitRecording(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recordingFile) {
      setError("Record or choose a message before sending.");
      return;
    }

    setPhase("uploading");
    setError("");
    setProgress(0);

    try {
      const form = new FormData(event.currentTarget);
      const contentType = normalizedType(recordingFile);
      const payload = {
        name: String(form.get("name") ?? ""),
        contact: String(form.get("contact") ?? ""),
        relationship: String(form.get("relationship") ?? "Friend"),
        firstMemory: birthday ? "A birthday message recorded for Sandi." : "A voice memory recorded for Sandi.",
        story: String(form.get("note") ?? ""),
        approximateYear: "2026",
        place: "",
        people: "",
        lifeChapter: birthday ? "Birthday wishes" : "Sandi today",
        prompt: birthday ? "BIRTHDAY_MESSAGE" : "VOICE_WALL",
        consent: Boolean(form.get("consent")),
        files: [{ name: recordingFile.name, type: contentType, size: recordingFile.size }]
      };
      setContributorName(payload.name);

      const prepareResponse = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) throw new Error(prepared.error || "Could not prepare the recording.");

      const target = prepared.uploads[0] as PreparedUpload;
      const blob = await upload(target.pathname, recordingFile, {
        access: "private",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({
          submissionId: prepared.submissionId,
          originalName: recordingFile.name,
          bytes: recordingFile.size,
          contentType
        }),
        contentType,
        multipart: recordingFile.size >= MULTIPART_THRESHOLD,
        onUploadProgress: event => setProgress(event.percentage)
      });

      const completed: CompletedFile = {
        ...blob,
        originalName: recordingFile.name,
        bytes: recordingFile.size,
        contentType
      };
      const completeResponse = await fetch("/api/submissions/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: prepared.submissionId, files: [completed] })
      });
      const result = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(result.error || "Could not confirm the recording.");
      setConfirmation(String(prepared.submissionId));
      setPhase("success");
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "The recording could not be sent.";
      setError(reason + " The recording is still on this screen. Try again or email it to uploads@sandi50th.com.");
      setPhase("preview");
    }
  }

  function stopTracks() {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (liveVideo.current) liveVideo.current.srcObject = null;
  }

  if (phase === "success") {
    return (
      <section className="contributionSuccess recorderSuccess" aria-live="polite">
        <span className="successMark">✓</span>
        <span className="eyebrow">{birthday ? "BIRTHDAY MESSAGE RECEIVED" : "VOICE MEMORY RECEIVED"}</span>
        <h2>Her story now carries your voice.</h2>
        <p>The recording is verified and backed up in private storage.</p>
        <p className="confirmationCode">Confirmation: {confirmation.slice(0, 8).toUpperCase()}</p>
        <NameChorusRecorder submissionId={confirmation} contributorName={contributorName} />
        <button type="button" className="secondary" onClick={() => window.location.reload()}>Record another</button>
      </section>
    );
  }

  return (
    <form className="recordingForm panel" onSubmit={submitRecording}>
      <header className="recorderHeader">
        <span className="eyebrow">{birthday ? "FOR AUGUST 11" : "A VOICE IN HER STORY"}</span>
        <h2>{birthday ? "Record a birthday message for Sandi." : "Tell the memory in your own voice."}</h2>
        <p>{birthday
          ? "Speak to her directly. Say her name. Tell her what you’d say if she were in front of you."
          : "Thirty to sixty seconds is enough. The pauses, the laugh, and the way you say her name are part of the memory."}</p>
      </header>

      {birthday && phase === "idle" && (
        <fieldset className="captureChoice">
          <legend>How would you like to record?</legend>
          <label><input type="radio" name="captureKind" checked={captureKind === "video"} onChange={() => setCaptureKind("video")} /> Camera and voice</label>
          <label><input type="radio" name="captureKind" checked={captureKind === "audio"} onChange={() => setCaptureKind("audio")} /> Voice only</label>
        </fieldset>
      )}

      <div className={"recorderStage recorder-" + phase}>
        {phase === "recording" && effectiveKind === "video" && <video ref={liveVideo} autoPlay muted playsInline aria-label="Live camera preview" />}
        {phase === "recording" && effectiveKind === "audio" && <div className="voicePulse" aria-hidden="true"><i/><i/><i/><i/><i/></div>}
        {phase === "recording" && (
          <div className="recordingClock" aria-live="polite">
            <strong>{formatTime(seconds)}</strong>
            <span>{seconds < 30 ? "Take your time — 30 to 120 seconds is a helpful guide." : seconds <= 120 ? "You are in the suggested range." : "You may finish your thought; this is a gentle guide, not a cutoff."}</span>
          </div>
        )}

        {phase === "preview" && previewUrl && (
          effectiveKind === "video"
            ? <video className="recordingPlayback" src={previewUrl} controls playsInline />
            : <audio className="recordingPlayback" src={previewUrl} controls />
        )}

        {(phase === "idle" || phase === "requesting") && (
          <div className="recorderStart">
            <button className="primary recordButton" type="button" disabled={phase === "requesting"} onClick={beginRecording}>
              {phase === "requesting" ? "Opening " + (effectiveKind === "video" ? "camera…" : "microphone…") : effectiveKind === "video" ? "Start camera message" : "Start voice recording"}
            </button>
            <label className="filePicker secondary">
              Choose an existing recording
              <input type="file" accept={birthday ? "audio/*,video/*" : "audio/*"} onChange={chooseFallback} />
            </label>
          </div>
        )}
      </div>

      {phase === "recording" && <button className="primary stopRecording" type="button" onClick={stopRecording}>Stop recording</button>}
      {phase === "preview" && (
        <div className="recordingActions">
          <button className="secondary" type="button" onClick={recordAgain}>Re-record</button>
          <span>Play it back before sending. Two or three attempts are welcome.</span>
        </div>
      )}

      <div className="grid2 recorderIdentity">
        <label>Your name<input name="name" required placeholder="Your name" /></label>
        <label>Email or phone<input name="contact" required placeholder="Only if we need help with the file" /></label>
        <label>Your relationship to Sandi
          <select name="relationship" defaultValue="Friend">
            <option>Family</option><option>Friend</option><option>Childhood friend</option><option>College friend</option><option>Colleague</option><option>Neighbor</option><option>Other</option>
          </select>
        </label>
        <label>Optional note<input name="note" placeholder="A date, place, or detail we should know" /></label>
      </div>

      <label className="consent contributionConsent">
        <input name="consent" type="checkbox" required />
        <span>I give permission to include this recording in Sandi’s private birthday film and archive.</span>
      </label>

      {phase === "uploading" && (
        <div className="uploadProgress" role="status" aria-live="polite">
          <span style={{ width: progress + "%" }} />
          <p>Sending and backing up your recording… {Math.round(progress)}%</p>
        </div>
      )}
      {error && (
        <div className="uploadError" role="alert">
          <strong>The recording has not been confirmed yet.</strong>
          <p>{error}</p>
          <a href={EMAIL_FALLBACK}>Email the recording instead</a>
        </div>
      )}
      <button className="primary submitMemory" type="submit" disabled={!recordingFile || phase === "uploading" || phase === "recording"}>
        {phase === "uploading" ? "Please keep this page open…" : birthday ? "Send my birthday message" : "Send my voice memory"}
      </button>
      <p className="secureNote">The recording goes directly to private storage and joins Sandi’s growing story. The reveal itself stays locked until August 11.</p>
    </form>
  );
}

function chooseMimeType(kind: CaptureKind) {
  const candidates = kind === "video"
    ? ["video/mp4", "video/webm;codecs=vp8,opus", "video/webm"]
    : ["audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

function extensionFor(type: string, kind: CaptureKind) {
  if (type.includes("mp4")) return kind === "video" ? "mp4" : "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  return "webm";
}

function isVideoFile(file: File) {
  if (file.type.startsWith("video/")) return true;
  return /\.(mov|mp4|m4v|webm)$/i.test(file.name);
}

function normalizedType(file: File) {
  if (file.type) return file.type.split(";")[0].toLowerCase();
  const name = file.name.toLowerCase();
  if (name.endsWith(".m4a")) return "audio/x-m4a";
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".mp3")) return "audio/mpeg";
  return name.endsWith(".webm") ? "video/webm" : "audio/webm";
}

function formatTime(seconds: number) {
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}
