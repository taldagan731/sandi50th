"use client";

import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { trimNameRecording } from "@/lib/audio/trim-silence";

type Phase = "idle" | "requesting" | "recording" | "preview" | "uploading" | "done";

export function NameChorusRecorder({
  submissionId,
  contributorName = "",
  standalone = false
}: {
  submissionId?: string;
  contributorName?: string;
  standalone?: boolean;
}) {
  const [name, setName] = useState(contributorName);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const timer = useRef<number | null>(null);
  const autoStop = useRef<number | null>(null);

  useEffect(() => () => cleanup(), []);

  async function begin() {
    setError("");
    if (standalone && !name.trim()) {
      setError("Add your name first, then record it.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record here. You can choose a short recording from Voice Memos instead.");
      return;
    }
    setPhase("requesting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mimeType = chooseAudioMimeType();
      const next = mimeType ? new MediaRecorder(media, { mimeType }) : new MediaRecorder(media);
      recorder.current = next;
      chunks.current = [];
      next.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      next.onstop = async () => {
        const type = next.mimeType || mimeType || "audio/webm";
        const raw = new File([new Blob(chunks.current, { type })], `name-chorus-${Date.now()}.${extensionFor(type)}`, { type });
        const trimmed = await trimNameRecording(raw);
        setFile(trimmed);
        setPreviewUrl(current => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(trimmed);
        });
        cleanup();
        setPhase("preview");
      };
      next.onerror = () => {
        cleanup();
        setError("The recording stopped unexpectedly. Try again or choose a Voice Memos file.");
        setPhase("idle");
      };
      next.start(250);
      setSeconds(0);
      timer.current = window.setInterval(() => setSeconds(value => value + 1), 1000);
      autoStop.current = window.setTimeout(stop, 5000);
      setPhase("recording");
    } catch {
      cleanup();
      setError("Microphone access was not available. Try again or choose a Voice Memos file.");
      setPhase("idle");
    }
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function cleanup() {
    if (timer.current) window.clearInterval(timer.current);
    if (autoStop.current) window.clearTimeout(autoStop.current);
    timer.current = null;
    autoStop.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setFile(null);
    setSeconds(0);
    setProgress(0);
    setError("");
    setPhase("idle");
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!selected.type.startsWith("audio/")) {
      setError("Please choose a short audio recording.");
      return;
    }
    setFile(selected);
    setPreviewUrl(current => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(selected);
    });
    setError("");
    setPhase("preview");
  }

  async function save() {
    if (!file || (standalone && !name.trim())) return;
    setPhase("uploading");
    setError("");
    setProgress(0);
    try {
      const contentType = file.type.split(";")[0].toLowerCase() || "audio/webm";
      const response = await fetch("/api/name-chorus/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, contributorName: name.trim(), contentType, bytes: file.size })
      });
      const prepared = await response.json();
      if (!response.ok) throw new Error(prepared.error || "The name recording could not be prepared.");
      const blob = await upload(prepared.pathname, file, {
        access: "private",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({
          submissionId: prepared.submissionId,
          originalName: prepared.originalName,
          bytes: file.size,
          contentType
        }),
        contentType,
        onUploadProgress: event => setProgress(event.percentage)
      });
      const completed = blob as PutBlobResult;
      const completeResponse = await fetch("/api/name-chorus/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: prepared.submissionId,
          file: { ...completed, originalName: prepared.originalName, bytes: file.size, contentType }
        })
      });
      const result = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(result.error || "The name recording could not be verified.");
      setPhase("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The name recording could not be saved.");
      setPhase("preview");
    }
  }

  return (
    <section className={standalone ? "nameChorusRecorder panel is-standalone" : "nameChorusRecorder"} aria-live="polite">
      <span className="eyebrow">COMPLETELY OPTIONAL</span>
      <h3>{standalone ? "Add your voice to the room." : "One more thing, if you’d like: say your name."}</h3>
      <p>So Sandi can hear who was here.</p>
      {standalone && phase !== "done" && (
        <label>Your name<input value={name} onChange={event => setName(event.target.value)} placeholder="Your name" autoComplete="name" /></label>
      )}
      {phase === "idle" && (
        <div className="nameRecorderActions">
          <button className="primary" type="button" onClick={begin}>Say my name</button>
          <label className="filePicker secondary">Choose a short recording<input type="file" accept="audio/*" onChange={chooseFile} /></label>
        </div>
      )}
      {phase === "requesting" && <p role="status">Opening the microphone…</p>}
      {phase === "recording" && (
        <div className="nameRecordingLive">
          <strong>{seconds}s</strong>
          <span>Say only your name. Recording stops at five seconds.</span>
          <button className="secondary" type="button" onClick={stop}>Stop</button>
        </div>
      )}
      {phase === "preview" && previewUrl && (
        <div className="nameRecordingPreview">
          <audio controls preload="metadata" src={previewUrl} />
          <button className="secondary" type="button" onClick={reset}>Re-record</button>
          <button className="primary" type="button" onClick={save}>Done — add my name</button>
        </div>
      )}
      {phase === "uploading" && <p role="status">Adding your voice… {Math.round(progress)}%</p>}
      {phase === "done" && <p className="nameChorusDone"><strong>Your voice is in the room.</strong> Thank you.</p>}
      {error && <p className="uploadError" role="alert">{error}</p>}
    </section>
  );
}

function chooseAudioMimeType() {
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"]
    .find(type => MediaRecorder.isTypeSupported(type)) || "";
}

function extensionFor(type: string) {
  if (type.includes("mp4")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  return "webm";
}
