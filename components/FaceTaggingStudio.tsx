"use client";

import { useEffect, useRef, useState } from "react";

type Status = { migrationRequired: boolean; externalApprovalRequired?: boolean; total: number; scanned: number; remaining: number; confirmed: number; questions: number; people: number; questionItems?: Array<{ mediaId: string; name: string }> };

export function FaceTaggingStudio() {
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const stop = useRef(false);

  async function load() {
    const response = await fetch("/api/studio/face-tagging", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error || "Face-tag status could not be loaded."); return; }
    setStatus(body);
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => { window.clearTimeout(timer); stop.current = true; }; }, []);

  async function run() {
    stop.current = false; setRunning(true); setError(""); setNotice("Preparing the confirmed face references…");
    try {
      while (!stop.current) {
        const response = await fetch("/api/studio/face-tagging", { method: "POST" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "AI face matching stopped.");
        if (body.result?.seedRequired) { setNotice("Tag at least one clear face by name below, then start the scan again."); break; }
        if (body.status) setStatus(body.status);
        setNotice(`Scanned ${body.status?.scanned ?? 0} of ${body.status?.total ?? 0} photographs · ${body.status?.questions ?? 0} need your answer`);
        if (body.result?.complete || !body.status?.remaining) { setNotice(`Face scan complete. ${body.status?.confirmed ?? 0} confirmed tags; ${body.status?.questions ?? 0} questions waiting for you.`); break; }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI face matching stopped."); }
    finally { setRunning(false); }
  }

  return (
    <section className="studioTools faceTaggingOverview" aria-labelledby="face-tagging-title">
      <header><div><span className="eyebrow">PEOPLE IN THE PHOTOGRAPHS</span><h2 id="face-tagging-title">Name once, then find similar faces.</h2><p>Mark a clear face in any photo manager card. AI compares the remaining photographs only with your confirmed references. Uncertain matches become questions; only confirmed names appear publicly.</p></div>{status && <strong>{status.people} named people</strong>}</header>
      {status?.migrationRequired ? <p className="studioNotice">Run <strong>supabase/photo-face-tags-migration.sql</strong> once before tagging faces.</p> : <>
        {status && <dl><div><dt>Photographs scanned</dt><dd>{status.scanned} / {status.total}</dd></div><div><dt>Confirmed face tags</dt><dd>{status.confirmed}</dd></div><div><dt>Questions for you</dt><dd>{status.questions}</dd></div><div><dt>Remaining</dt><dd>{status.remaining}</dd></div></dl>}
        <div className="faceTaggingActions"><button className="primary" type="button" disabled={running || !status?.remaining || status?.externalApprovalRequired} onClick={run}>{running ? "Matching faces…" : "Find similar faces in remaining photos"}</button>{running && <button className="secondary" type="button" onClick={() => { stop.current = true; setNotice("Stopping after the current photograph…"); }}>Stop after this photo</button>}</div>
        {status?.externalApprovalRequired && <p className="studioNotice">Automatic matching is locked until you explicitly approve sending reduced, metadata-free target photos and cropped reference faces to Anthropic. Manual face tags and public labels already work without that transfer.</p>}
        {Boolean(status?.questionItems?.length) && <nav className="faceQuestionLinks" aria-label="Photographs with uncertain face matches"><strong>Needs your answer</strong>{status?.questionItems?.map(item => <a key={item.mediaId} href={`#manage-media-${item.mediaId}`}>{item.name}</a>)}</nav>}
      </>}
      {notice && <p className="studioNotice" role="status">{notice}</p>}{error && <p className="studioError" role="alert">{error}</p>}
    </section>
  );
}
