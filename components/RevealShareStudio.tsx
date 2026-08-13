"use client";

import { useEffect, useState } from "react";

type ShareStatus = {
  id: string;
  enabled: boolean;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  useCount: number;
  lastUsedAt: string | null;
};

function defaultWednesdayExpiry() {
  return "2026-08-12T23:59";
}

export function RevealShareStudio() {
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [expiresAt, setExpiresAt] = useState(defaultWednesdayExpiry);
  const [shareUrl, setShareUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);

  async function load() {
    const response = await fetch("/api/studio/reveal-share", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    setStatus(body.active ?? null);
    setMigrationRequired(Boolean(body.migrationRequired));
  }

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function createLink() {
    setWorking(true);
    setError("");
    setNotice("");
    setShareUrl("");
    const response = await fetch("/api/studio/reveal-share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", expiresAt: new Date(expiresAt).toISOString() })
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "The guest link could not be created.");
    else {
      setShareUrl(body.url);
      setStatus(body.active ?? null);
      setMigrationRequired(false);
      setNotice("New guest link created. Copy it now; only its secure hash is stored.");
    }
    setWorking(false);
  }

  async function revokeLink() {
    if (!status) return;
    setWorking(true);
    setError("");
    const response = await fetch("/api/studio/reveal-share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", id: status.id })
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "The guest link could not be revoked.");
    else {
      setStatus(body.active ?? null);
      setShareUrl("");
      setNotice("Guest link revoked. Existing guest cookies stopped working immediately.");
    }
    setWorking(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setNotice("Guest link copied.");
  }

  return (
    <section className="studioTools revealShareStudio" aria-labelledby="reveal-share-title">
      <header>
        <div>
          <span className="eyebrow">PRIVATE GUEST PREVIEW</span>
          <h2 id="reveal-share-title">Share the reveal without a password</h2>
          <p>The link opens only the reveal, remains noindexed, expires automatically, and can be revoked without affecting your owner access.</p>
        </div>
        {status && <dl><div><dt>Uses</dt><dd>{status.useCount}</dd></div><div><dt>Status</dt><dd>{status.enabled ? "Active" : "Closed"}</dd></div></dl>}
      </header>

      {migrationRequired && <p className="studioNotice">Install <strong>supabase/reveal-share-links-migration.sql</strong> once before creating the first link.</p>}
      <div className="revealShareControls">
        <label>Expires Wednesday night <input type="datetime-local" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} /></label>
        <button className="primary" type="button" disabled={working || migrationRequired} onClick={createLink}>{working ? "Working…" : status?.enabled ? "Replace guest link" : "Create guest link"}</button>
        {status?.enabled && <button className="secondary" type="button" disabled={working} onClick={revokeLink}>Revoke now</button>}
      </div>

      {shareUrl && <div className="revealShareResult"><input readOnly value={shareUrl} aria-label="Guest reveal share link" /><button className="secondary" type="button" onClick={copyLink}>Copy link</button></div>}
      {status?.lastUsedAt && <p className="muted">Last opened {new Date(status.lastUsedAt).toLocaleString()} · {status.useCount} total link use{status.useCount === 1 ? "" : "s"}</p>}
      {notice && <p className="studioNotice">{notice}</p>}
      {error && <p className="studioError" role="alert">{error}</p>}
    </section>
  );
}
