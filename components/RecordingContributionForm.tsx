"use client";

import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import { fireContributionConfetti } from "@/lib/confetti";
import { fireContributionBalloons } from "@/lib/balloons";
import { NameChorusRecorder } from "@/components/NameChorusRecorder";
import { trackContributionStep } from "@/lib/contribution-attempt";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

const EMAIL_FALLBACK = "mailto:uploads@sandi50th.com?subject=Sandi%2050th%20recording";
const MAX_BYTES = 5 * 1024 * 1024 * 1024;
const MULTIPART_THRESHOLD = 100 * 1024 * 1024;

type RecordingKind = "voice" | "birthday";
type CaptureKind = "audio" | "video";
type PreparedUpload = { pathname: string; name: string; type: string; size: number };
type CompletedFile = PutBlobResult & { originalName: string; bytes: number };

export function RecordingContributionForm({ kind }: { kind: RecordingKind }) {
  const [captureKind, setCaptureKind] = useState<CaptureKind>(kind === "birthday" ? "video" : "audio");
  const [phase, setPhase] = useState<"idle" | "requesting" | "recording" | "preview" | "uploading" | "success">("idle");
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [contributorName, setContributorName] = useState("");
  const [simpleStep, setSimpleStep] = useState(1);
  const [contact, setContact] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const liveVideo = useRef<HTMLVideoElement>(null);
  const timer = useRef<number | null>(null);
  const celebrated = useRef(false);
  const consentRef = useRef<HTMLInputElement>(null);

  const birthday = kind === "birthday";
  const effectiveKind: CaptureKind = birthday ? captureKind : "audio";

  useEffect(() => {
    trackContributionStep(kind, simpleStep);
  }, [kind, simpleStep]);

  useEffect(() => {
    if (phase !== "success" || celebrated.current) return;
    celebrated.current = true;
    fireContributionConfetti();
    fireContributionBalloons();
    trackContributionStep(kind, 4, "completed");
  }, [kind, phase]);

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

  async function beginRecording(requestedKind: CaptureKind = effectiveKind) {
    setError("");
    discardPreview();
    setCaptureKind(requestedKind);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record directly. Tap Use phone camera or Choose an existing recording instead.");
      setPhase("idle");
      return;
    }
    setPhase("requesting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: requestedKind === "video"
          ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
          : false
      });
      stream.current = media;
      if (liveVideo.current) liveVideo.current.srcObject = media;

      const mimeType = chooseMimeType(requestedKind);
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
        const type = (nextRecorder.mimeType || mimeType || (requestedKind === "video" ? "video/webm" : "audio/webm")).split(";", 1)[0].toLowerCase();
        const blob = new Blob(chunks.current, { type });
        if (!blob.size) {
          setError("The phone created an empty recording. Tap Use phone camera; it is the most reliable option on this device.");
          stopTracks();
          setPhase("idle");
          return;
        }
        const extension = extensionFor(type, requestedKind);
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
      setError(mediaAccessMessage(cause, requestedKind));
      stopTracks();
      setPhase("idle");
    }
  }

  function stopRecording() {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    if (recorder.current?.state === "recording") {
      try { recorder.current.requestData(); } catch { /* optional in older browsers */ }
      recorder.current.stop();
    }
  }

  function recordAgain() {
    discardPreview();
    setSeconds(0);
    setError("");
    setPhase("idle");
  }

  function discardPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setRecordingFile(null);
  }

  function chooseFallback(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("That recording is over the 5 GB limit. Email uploads@sandi50th.com and we will arrange another transfer.");
      return;
    }
    if (!isAudioVideoFile(file)) {
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
    if (!consentGiven) {
      setError("Please check the permission box so we can safely add your recording for Sandi.");
      consentRef.current?.focus();
      consentRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      return;
    }

    trackContributionStep(kind, 3, "sending");
    setPhase("uploading");
    setError("");
    setProgress(0);

    try {
      const form = new FormData(event.currentTarget);
      const contentType = normalizedType(recordingFile);
      const payload = {
        name: contributorName.trim(),
        contact: contact.trim(),
        relationship: String(form.get("relationship") ?? "Friend"),
        firstMemory: birthday ? "A birthday message recorded for Sandi." : "A voice memory recorded for Sandi.",
        story: String(form.get("note") ?? ""),
        approximateYear: "2026",
        place: "",
        people: "",
        lifeChapter: birthday ? "Birthday wishes" : "Sandi today",
        prompt: birthday ? "BIRTHDAY_MESSAGE" : "VOICE_WALL",
        consent: consentGiven,
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
      const blob = await uploadRecordingWithRetry(target, recordingFile, String(prepared.submissionId), contentType, percentage => setProgress(percentage));

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
      trackContributionStep(kind, 3, "failed");
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
    <form className="recordingForm panel simpleContributionWizard" onSubmit={submitRecording} noValidate>
      <header className="simpleWizardHeader">
        <span>Step {simpleStep} of 3</span>
        <div aria-hidden="true"><i className={simpleStep >= 1 ? "done" : ""}/><i className={simpleStep >= 2 ? "done" : ""}/><i className={simpleStep >= 3 ? "done" : ""}/></div>
      </header>

      {simpleStep === 1 && (
        <section className="simpleWizardStep">
          <h2>First, what is your name?</h2>
          <p>Sandi should know exactly who this came from.</p>
          <label htmlFor="recording-name">Your name <strong>Required</strong></label>
          <input id="recording-name" autoFocus value={contributorName} onChange={event => setContributorName(event.target.value)} placeholder="Your name" />
          {!contributorName.trim() && <small className="simpleInlineHelp">We need your name so Sandi knows who this is from.</small>}
          <button className="primary simpleContinue" type="button" disabled={!contributorName.trim()} onClick={() => setSimpleStep(2)}>Continue</button>
        </section>
      )}

      {simpleStep === 2 && (
        <section className="simpleWizardStep">
          <h2>{birthday ? "Record your birthday video." : "Record your voice."}</h2>
          <p>{birthday ? "Speak directly to Sandi. A short message is perfect." : "Tell the memory naturally. Thirty seconds is enough."}</p>
          {phase !== "uploading" && <div className="simpleRecordingChoices">
            {birthday && <button className="primary" type="button" disabled={phase === "requesting" || phase === "recording"} onClick={() => beginRecording("video")}>Record video now</button>}
            {!birthday && <button className="primary" type="button" disabled={phase === "requesting" || phase === "recording"} onClick={() => beginRecording("audio")}>Record voice now</button>}
            {birthday && <label className="filePicker secondary">Use phone camera<input type="file" accept="video/*" capture="user" disabled={phase === "requesting" || phase === "recording"} onChange={chooseFallback}/></label>}
            <label className="filePicker secondary">Choose an existing {birthday ? "video" : "recording"}<input type="file" accept={birthday ? "video/*" : "audio/*"} disabled={phase === "requesting" || phase === "recording"} onChange={chooseFallback}/></label>
          </div>}
          {(phase === "idle" || phase === "requesting") && (
            <p className="recorderStartInstruction" aria-live="polite">
              <span aria-hidden="true">{"\u2191"}</span> {phase === "requesting" ? "Opening your microphone..." : birthday ? "Tap Record video now above to begin." : "Tap Record voice now above to begin."}
            </p>
          )}
          {(phase === "recording" || phase === "preview") && <div className={"recorderStage recorder-" + phase}>
            {phase === "recording" && effectiveKind === "video" && <video ref={liveVideo} autoPlay muted playsInline aria-label="Live camera preview"/>}
            {phase === "recording" && effectiveKind === "audio" && <div className="voicePulse" aria-hidden="true"><i/><i/><i/><i/><i/></div>}
            {phase === "recording" && <div className="recordingClock"><strong>{formatTime(seconds)}</strong><span>Tap Stop when you are finished.</span></div>}
            {phase === "preview" && previewUrl && (effectiveKind === "video" ? <video className="recordingPlayback" src={previewUrl} controls playsInline/> : <audio className="recordingPlayback" src={previewUrl} controls/>)}
          </div>}
          {phase === "recording" && <button className="primary stopRecording" type="button" onClick={stopRecording}>Stop recording</button>}
          {phase === "preview" && <button className="secondary" type="button" onClick={recordAgain}>Record again</button>}
          {error && <p className="simpleInlineError" role="alert">{error}</p>}
          {!recordingFile && phase !== "recording" && <small className="simpleInlineHelp">Make or choose one recording before continuing.</small>}
          <div className="simpleWizardActions"><button className="secondary" type="button" onClick={() => setSimpleStep(1)}>Back</button><button className="primary" type="button" disabled={!recordingFile || phase !== "preview"} onClick={() => setSimpleStep(3)}>Continue</button></div>
        </section>
      )}

      {simpleStep === 3 && (
        <section className="simpleWizardStep">
          <h2>Ready to send.</h2>
          <p>Your {birthday ? "birthday video" : "voice recording"} is ready. Confirm permission, then tap Send.</p>
          <label className="consent contributionConsent simpleConsent"><input ref={consentRef} type="checkbox" checked={consentGiven} onChange={event => { setConsentGiven(event.target.checked); if (event.target.checked) setError(""); }}/><span>I have permission to share this recording with Sandi. <strong>Required</strong></span></label>
          {!consentGiven && <small className="simpleInlineHelp">Check this box, then tap Send recording now.</small>}
          {previewUrl && (effectiveKind === "video" ? <video className="recordingPlayback simpleFinalPreview" src={previewUrl} controls playsInline/> : <audio className="recordingPlayback simpleFinalPreview" src={previewUrl} controls/>)}
          <label htmlFor="recording-contact">Email or phone <em>Optional</em></label>
          <input id="recording-contact" value={contact} onChange={event => setContact(event.target.value)} placeholder="Only if we need help with the file" />
          <details className="simpleOptional"><summary>Add an optional note</summary><label>Note <em>Optional</em><input name="note" placeholder="A date, place, or detail"/></label><input type="hidden" name="relationship" value="Other"/></details>

          {phase === "uploading" && <div className="uploadProgress" role="status"><span style={{width: progress + "%"}}/><p>Sending... {Math.round(progress)}%</p></div>}
          {error && <div className="uploadError" role="alert"><strong>Not sent yet.</strong><p>{error}</p><a href={EMAIL_FALLBACK}>Email it instead</a></div>}
          <div className="simpleWizardActions"><button className="secondary" type="button" disabled={phase === "uploading"} onClick={() => setSimpleStep(2)}>Back</button><button className="primary" type="submit" disabled={!recordingFile || phase === "uploading"}>{phase === "uploading" ? "Sending... keep this page open" : "Send recording now"}</button></div>
        </section>
      )}
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

function isAudioVideoFile(file: File) {
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) return true;
  return /\.(m4a|aac|caf|mp3|wav|ogg|oga|webm|mov|mp4|m4v|3gp|3g2)$/i.test(file.name);
}

function normalizedType(file: File) {
  const name = file.name.toLowerCase();
  const declared = file.type.split(";")[0].toLowerCase();
  if (name.endsWith(".m4a") || declared === "audio/x-m4a" || declared === "audio/m4a") return "audio/mp4";
  if (declared) return declared;

  if (name.endsWith(".m4a")) return "audio/x-m4a";
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".mp3")) return "audio/mpeg";
  return name.endsWith(".webm") ? "video/webm" : "audio/webm";
}

function formatTime(seconds: number) {
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}
function mediaAccessMessage(cause: unknown, requestedKind: CaptureKind) {
  const name = cause instanceof DOMException ? cause.name : "";
  const device = requestedKind === "video" ? "camera and microphone" : "microphone";
  if (name === "NotAllowedError" || name === "SecurityError") return `The ${device} permission was blocked. Allow it for sandi50th.com in the browser's site settings, or use the phone recorder option.`;
  if (name === "NotFoundError" || name === "OverconstrainedError") return `This device did not provide the requested ${device}. Use the phone recorder option instead.`;
  if (name === "NotReadableError" || name === "AbortError") return `Another app may be using the ${device}. Close the other app and try again, or use the phone recorder option.`;
  return `The ${device} could not open here. Use the phone recorder option; your message can still be sent.`;
}

async function uploadRecordingWithRetry(target: PreparedUpload, file: File, submissionId: string, contentType: string, onProgress: (percentage: number) => void) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await upload(target.pathname, file, {
        access: "private",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({ submissionId, originalName: file.name, bytes: file.size, contentType }),
        contentType,
        multipart: file.size >= MULTIPART_THRESHOLD,
        onUploadProgress: event => onProgress(event.percentage)
      });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => window.setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The recording could not be uploaded after three attempts.");
}
