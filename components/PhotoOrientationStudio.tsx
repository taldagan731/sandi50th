"use client";

import { useEffect, useState } from "react";

type Photo = {
  id: string;
  originalName: string;
  contributorName: string;
  chapterNumber: number | null;
  posterReady: boolean;
  manualRotation: number;
  version?: number;
};

export function PhotoOrientationStudio() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/studio/photo-orientation", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Photographs could not be loaded.");
      return;
    }
    setPhotos(body.photos ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function scanAndRepair() {
    setScanning(true);
    setError("");
    setNotice("Scanning originals for EXIF orientation…");
    let offset = 0;
    let total = photos.length;
    let scanned = 0;
    let affected = 0;
    let repaired = 0;
    let failed = 0;
    let nonNormalServed = 0;
    while (offset < total) {
      const response = await fetch("/api/studio/photo-orientation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan", offset, limit: 4 })
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || "The orientation scan stopped.");
        break;
      }
      total = Number(body.total || total);
      const results = Array.isArray(body.results) ? body.results : [];
      scanned += results.length;
      affected += results.filter((item: { affected?: boolean }) => item.affected).length;
      repaired += results.filter((item: { repaired?: boolean }) => item.repaired).length;
      failed += results.filter((item: { error?: string }) => Boolean(item.error)).length;
      nonNormalServed += results.filter((item: { repaired?: boolean; servedOrientation?: number }) => item.repaired && item.servedOrientation !== 1).length;
      offset = Number(body.nextOffset || total);
      setNotice(`Scanned ${scanned} of ${total} photographs · ${repaired} corrected so far`);
      if (!results.length) break;
    }
    setNotice(`Scan complete: ${scanned} photographs checked, ${affected} affected, ${repaired} corrected, ${failed} failed, ${nonNormalServed} corrected derivatives still non-normal.`);
    setScanning(false);
    await load();
  }

  async function rotate(photo: Photo, direction: "left" | "right") {
    setWorkingId(photo.id);
    setError("");
    const response = await fetch("/api/studio/photo-orientation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rotate", mediaId: photo.id, direction })
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || "The photograph could not be rotated.");
    else setPhotos(current => current.map(item => item.id === photo.id ? { ...item, manualRotation: body.manualRotation, version: body.version } : item));
    setWorkingId(null);
  }

  return (
    <section className="studioTools photoOrientationStudio" aria-labelledby="photo-orientation-title">
      <header>
        <div>
          <span className="eyebrow">PHOTO ORIENTATION</span>
          <h2 id="photo-orientation-title">Make every photograph upright</h2>
          <p>The automatic scan repairs EXIF rotations without touching originals. Open the grid to correct scanned prints manually.</p>
        </div>
        <strong>{photos.length} photos</strong>
      </header>
      <div className="photoOrientationActions">
        <button className="primary" type="button" disabled={scanning} onClick={scanAndRepair}>{scanning ? "Scanning and repairing…" : "Scan and repair stored photos"}</button>
        <button className="secondary" type="button" onClick={() => setOpen(value => !value)}>{open ? "Close thumbnail grid" : "Review every thumbnail"}</button>
      </div>
      {notice && <p className="studioNotice" role="status">{notice}</p>}
      {error && <p className="studioError" role="alert">{error}</p>}
      {open && (
        <div className="photoOrientationGrid">
          {photos.map(photo => (
            <article key={photo.id}>
              <img src={`/api/studio/media/${photo.id}?v=${photo.version || 0}`} alt={photo.originalName} loading="lazy" />
              <div><strong>{photo.originalName}</strong><small>{photo.contributorName} · Chapter {photo.chapterNumber || "unassigned"}</small></div>
              <footer>
                <button type="button" disabled={workingId === photo.id} onClick={() => rotate(photo, "left")} aria-label={`Rotate ${photo.originalName} left`}>↶ Left</button>
                <button type="button" disabled={workingId === photo.id} onClick={() => rotate(photo, "right")} aria-label={`Rotate ${photo.originalName} right`}>Right ↷</button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
