"use client";

import { useState } from "react";

const DELETE_KEYWORD = "Purple50";

type Stage = "idle" | "warning" | "keyword" | "deleting";

export function MediaDeletionControl({
  mediaId,
  mediaName,
  mediaKind,
  disabled,
  onDeleted
}: {
  mediaId: string;
  mediaName: string;
  mediaKind: "photo" | "video";
  disabled?: boolean;
  onDeleted: () => Promise<void>;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState("");

  function cancel() {
    setStage("idle");
    setKeyword("");
    setError("");
  }

  async function permanentlyDelete() {
    if (stage !== "keyword" || keyword !== DELETE_KEYWORD) return;
    setStage("deleting");
    setError("");
    try {
      const response = await fetch("/api/studio/media-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId,
          firstConfirmation: "I understand this cannot be undone",
          keyword
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `The ${mediaKind} could not be deleted.`);
      await onDeleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `The ${mediaKind} could not be deleted.`);
      setStage("keyword");
    }
  }

  if (stage === "idle") {
    return (
      <div className="mediaDeleteZone">
        <button className="mediaDeleteStart" type="button" disabled={disabled} onClick={() => setStage("warning")}>
          Permanently delete {mediaKind}
        </button>
      </div>
    );
  }

  return (
    <section className="mediaDeleteZone isConfirming" aria-label={`Permanent deletion for ${mediaName}`}>
      {stage === "warning" ? (
        <>
          <p role="alert"><strong>First confirmation:</strong> Permanently delete <b>{mediaName}</b>? It will disappear from Studio and the reveal and cannot be restored.</p>
          <div className="mediaDeleteActions">
            <button className="mediaDeleteContinue" type="button" onClick={() => setStage("keyword")}>Continue to final confirmation</button>
            <button type="button" onClick={cancel}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <label htmlFor={`delete-keyword-${mediaId}`}>
            Final confirmation: type <strong>{DELETE_KEYWORD}</strong>
            <input
              id={`delete-keyword-${mediaId}`}
              type="text"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={stage === "deleting"}
              autoFocus
            />
          </label>
          <div className="mediaDeleteActions">
            <button
              className="mediaDeleteFinal"
              type="button"
              disabled={stage === "deleting" || keyword !== DELETE_KEYWORD}
              onClick={permanentlyDelete}
            >
              {stage === "deleting" ? "Deleting permanently…" : `Delete ${mediaKind} permanently`}
            </button>
            <button type="button" disabled={stage === "deleting"} onClick={cancel}>Cancel</button>
          </div>
          {error && <p className="studioError" role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
