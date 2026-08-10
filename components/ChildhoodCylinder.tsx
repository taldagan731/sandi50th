"use client";

import { type CSSProperties, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./ChildhoodCylinder.module.css";
import { PhotoStoryViewer } from "@/components/PhotoStoryViewer";
import { useFilmMotionPreference } from "@/lib/use-film-motion-preference";

type Photo = {
  id: string;
  originalName: string;
  caption: string;
  contributorName: string;
  yearStart: number | null;
  displayOrder: number;
};

const approvedIds = [
  "aed7a0ce-5ab4-4d94-8568-8b9c9b01f2c6", "8ff86401-5b8f-43ca-9767-bd5958d973e9",
  "1befbb8d-7705-49bb-9fb3-195d9699f338", "939ae8d1-fe2d-46d1-88ea-57dff690d17e",
  "d870e5de-8916-4e1b-a104-0445ef66e613", "ed4b6a8a-050c-44ae-ac96-acf29829712e",
  "b4f49e2b-73f2-4077-be46-d2fb3bf8fc8f", "bbdc50fa-b831-4a30-a172-4fc6da7e0fbb",
  "84e4f7a2-66ed-4887-b43a-395ae7814480", "979cce01-f073-40f1-9c2f-93d8c12b9c30",
  "22f2dd7e-f81d-4e29-aef8-76b863545433", "b4c57243-9d1c-4284-811a-dbc6cdb44146",
  "d9b2243e-737a-4756-9491-95c9e525cfb8", "892aae40-0bee-4f15-8ee5-af8773a0d4ee",
  "c01afe82-8a9b-4a3f-b97d-c8e6051ead91", "d53cba49-cb24-4114-a60e-4bfe53912dbe",
  "10c9b5bb-59d5-4ed9-bef3-60284416ac80", "67c591f9-1a1b-4007-b2be-ddf616deae82"
] as const;

const mediaUrl = (id: string) => `/api/reveal/media/${id}`;
const filmPhotoProps = (id: string) => ({
  src: `${mediaUrl(id)}?width=640`,
  srcSet: `${mediaUrl(id)}?width=640 640w, ${mediaUrl(id)}?width=960 960w`,
  sizes: "(max-width: 700px) 58vw, 384px",
});

export function ChildhoodCylinder({ photos, chapterPhotos }: { photos: Photo[]; chapterPhotos: Photo[] }) {
  const selected = useMemo(() => {
    const byId = new Map(photos.map(photo => [photo.id, photo]));
    return approvedIds.flatMap(id => byId.get(id) ? [byId.get(id)!] : []);
  }, [photos]);
  const gallery = useMemo(() => [...chapterPhotos]
    .filter(photo => !approvedIds.includes(photo.id as (typeof approvedIds)[number]))
    .sort((a, b) => (a.yearStart ?? 9999) - (b.yearStart ?? 9999) || a.displayOrder - b.displayOrder)
    .slice(0, 59), [chapterPhotos]);
  const galleryRows = useMemo(() => {
    const rows: Photo[][] = [[], [], []];
    gallery.forEach((photo, index) => rows[index % rows.length].push(photo));
    return rows;
  }, [gallery]);
  const pointer = useRef({ active: false, x: 0, at: 0, moved: false, velocity: 0 });
  const galleryRef = useRef<HTMLElement>(null);
  const [dragAngle, setDragAngle] = useState(0);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState<Photo | null>(null);
  const [marqueeVisible, setMarqueeVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [touchPaused, setTouchPaused] = useState(false);
  const filmMotion = useFilmMotionPreference();

  useEffect(() => {
    const element = galleryRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setMarqueeVisible(entry.isIntersecting), { threshold: .01 });
    const handleVisibility = () => setDocumentVisible(!document.hidden);
    observer.observe(element);
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!touchPaused || expanded) return;
    function resumeFromOutside(event: globalThis.PointerEvent) {
      if (event.target instanceof Node && !galleryRef.current?.contains(event.target)) setTouchPaused(false);
    }
    document.addEventListener("pointerdown", resumeFromOutside, true);
    return () => document.removeEventListener("pointerdown", resumeFromOutside, true);
  }, [touchPaused, expanded]);

  if (!selected.length) return null;

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointer.current = { active: true, x: event.clientX, at: performance.now(), moved: false, velocity: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPaused(true);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointer.current.active) return;
    const now = performance.now();
    const dx = event.clientX - pointer.current.x;
    const delta = dx * .34;
    pointer.current.velocity = delta / Math.max(8, now - pointer.current.at);
    pointer.current.x = event.clientX;
    pointer.current.at = now;
    pointer.current.moved ||= Math.abs(dx) > 4;
    setDragAngle(angle => angle + delta);
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!pointer.current.active) return;
    pointer.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragAngle(angle => angle + pointer.current.velocity * 180);
    window.setTimeout(() => setPaused(false), 700);
  }
  function open(photo: Photo) {
    if (pointer.current.moved) { pointer.current.moved = false; return; }
    setExpanded(photo);
    setPaused(true);
  }
  function closeViewer() {
    setExpanded(null);
    setPaused(false);
    setTouchPaused(false);
  }
  const marqueePaused = !filmMotion.moving || !marqueeVisible || !documentVisible || touchPaused || expanded !== null;

  return (
    <section className={styles.section} aria-labelledby="childhood-cylinder-title">
      <header className={styles.header}><span className="eyebrow">ONCE UPON A TIME</span><h3 id="childhood-cylinder-title">Eighteen glimpses of the beginning.</h3><p>Drag to turn the photographs. Pause on one and open it to see the complete frame.</p></header>
      <div className={`${styles.stage} ${paused ? styles.paused : ""}`} tabIndex={0} role="region" aria-label="Childhood photograph cylinder" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onMouseEnter={() => setPaused(true)} onMouseLeave={() => { if (!pointer.current.active) setPaused(false); }} onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setDragAngle(angle => angle + (event.key === "ArrowLeft" ? 20 : -20)); } }}>
        <div className={styles.drift}><div className={styles.ring} style={{ "--drag-angle": `${dragAngle}deg` } as CSSProperties}>
          {selected.map((photo, index) => <button key={photo.id} type="button" className={styles.face} style={{ "--face-angle": `${index * 20}deg` } as CSSProperties} onClick={() => open(photo)}><img {...filmPhotoProps(photo.id)} alt={photo.caption || `Childhood photograph of Sandi shared by ${photo.contributorName}`} draggable={false} loading={index < 5 ? "eager" : "lazy"} decoding="async" /><span>{photo.caption || photo.originalName}</span></button>)}
        </div></div>
      </div>
      <div className={styles.reducedGrid}>{selected.map(photo => <button type="button" key={photo.id} onClick={() => open(photo)}><img src={mediaUrl(photo.id)} alt={photo.caption || `Childhood photograph of Sandi shared by ${photo.contributorName}`} loading="lazy" /></button>)}</div>
      <section
        ref={galleryRef}
        className={`${styles.gallery} ${filmMotion.moving ? styles.motionEnabled : ""} ${marqueePaused ? styles.marqueePaused : ""}`}
        aria-labelledby="childhood-gallery-title"
        onPointerDown={event => { if (event.pointerType !== "mouse") setTouchPaused(true); }}
      >
        <header><span className="eyebrow">THE CHILDHOOD ALBUM</span><h3 id="childhood-gallery-title">Fifty-nine photographs, drifting through time.</h3><p>Hover or touch to pause. Open any photograph to see the complete frame.</p>{filmMotion.reducedMotion && <button className={styles.filmMotionToggle} type="button" aria-pressed={filmMotion.moving} onPointerDown={event => event.stopPropagation()} onClick={filmMotion.toggle}>{filmMotion.moving ? "Pause film strips" : "Play film strips"}</button>}</header>
        <div className={styles.marqueeViewport} aria-label="Diagonal moving childhood photograph album">
          <div className={styles.diagonalCanvas}>
            {galleryRows.map((row, rowIndex) => (
              <div className={`${styles.marqueeRow} ${rowIndex === 1 ? styles.reverse : ""}`} key={`row-${rowIndex}`}>
                <div className={styles.marqueeTrack} style={{ "--marquee-duration": ["72s", "86s", "100s"][rowIndex] } as CSSProperties}>
                  {[false, true].map(duplicate => (
                    <div className={styles.marqueeGroup} aria-hidden={duplicate || undefined} key={duplicate ? "duplicate" : "original"}>
                      {row.map(photo => (
                        <button className={styles.marqueePhoto} type="button" key={photo.id + (duplicate ? "-duplicate" : "")} tabIndex={duplicate ? -1 : undefined} onClick={() => open(photo)}>
                          <img {...filmPhotoProps(photo.id)} alt={duplicate ? "" : photo.caption || `Photograph of Sandi shared by ${photo.contributorName}`} loading="lazy" decoding="async" />
                          <span>{photo.yearStart || photo.caption || "Open full photograph"}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.marqueeReducedGrid} aria-label="Childhood photograph album">
          {gallery.map(photo => <button type="button" key={photo.id} onClick={() => open(photo)}><img src={mediaUrl(photo.id)} alt={photo.caption || `Photograph of Sandi shared by ${photo.contributorName}`} loading="lazy" /></button>)}
        </div>
      </section>
      {expanded && <PhotoStoryViewer mediaId={expanded.id} src={mediaUrl(expanded.id)} alt={expanded.caption || expanded.originalName} onClose={closeViewer} />}
    </section>
  );
}
