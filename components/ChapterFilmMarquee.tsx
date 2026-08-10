"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { PhotoStoryViewer } from "@/components/PhotoStoryViewer";
import styles from "./ChildhoodCylinder.module.css";

export type ChapterFilmPhoto = {
  id: string;
  originalName: string;
  caption: string;
  contributorName: string;
  yearStart: number | null;
  displayOrder: number;
};

const mediaUrl = (id: string) => `/api/reveal/media/${id}`;

export function ChapterFilmMarquee({ chapterNumber, chapterTitle, photos }: { chapterNumber: number; chapterTitle: string; photos: ChapterFilmPhoto[] }) {
  const galleryRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState<ChapterFilmPhoto | null>(null);
  const [visible, setVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [touchPaused, setTouchPaused] = useState(false);
  const ordered = useMemo(() => [...photos].sort((a, b) => (a.yearStart ?? 9999) - (b.yearStart ?? 9999) || a.displayOrder - b.displayOrder), [photos]);
  const rowCount = ordered.length >= 9 ? 3 : ordered.length >= 4 ? 2 : 1;
  const rows = useMemo(() => {
    const result = Array.from({ length: rowCount }, () => [] as ChapterFilmPhoto[]);
    ordered.forEach((photo, index) => result[index % rowCount].push(photo));
    return result;
  }, [ordered, rowCount]);

  useEffect(() => {
    const element = galleryRef.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .01 });
    const handleVisibility = () => setDocumentVisible(!document.hidden);
    observer.observe(element);
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", handleVisibility); };
  }, []);

  useEffect(() => {
    if (!touchPaused || expanded) return;
    const resume = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !galleryRef.current?.contains(event.target)) setTouchPaused(false);
    };
    document.addEventListener("pointerdown", resume, true);
    return () => document.removeEventListener("pointerdown", resume, true);
  }, [touchPaused, expanded]);

  if (!ordered.length) return null;
  const paused = !visible || !documentVisible || touchPaused || expanded !== null;
  const rowClass = rowCount === 1 ? styles.oneRow : rowCount === 2 ? styles.twoRows : styles.threeRows;

  return (
    <section ref={galleryRef} className={`${styles.chapterFilmSection} ${rowClass} ${paused ? styles.marqueePaused : ""}`} aria-labelledby={`chapter-film-title-${chapterNumber}`} onPointerDown={event => { if (event.pointerType !== "mouse") setTouchPaused(true); }}>
      <header>
        <span className="eyebrow">CHAPTER {String(chapterNumber).padStart(2, "0")} · THE PHOTOGRAPH ALBUM</span>
        <h3 id={`chapter-film-title-${chapterNumber}`}>{chapterTitle}, alive on film.</h3>
        <p>{ordered.length} photograph{ordered.length === 1 ? "" : "s"}. Hover or touch a strip to pause; open any frame to look closer and add what you remember.</p>
      </header>
      <div className={styles.marqueeViewport} aria-label={`Moving film album for ${chapterTitle}`}>
        <div className={styles.diagonalCanvas}>
          {rows.map((row, rowIndex) => {
            const duration = `${Math.max(58, row.length * 8 + rowIndex * 11)}s`;
            return (
              <div className={`${styles.marqueeRow} ${rowIndex % 2 === 1 ? styles.reverse : ""}`} key={`chapter-${chapterNumber}-row-${rowIndex}`}>
                <div className={styles.marqueeTrack} style={{ "--marquee-duration": duration } as CSSProperties}>
                  {[false, true].map(duplicate => (
                    <div className={styles.marqueeGroup} aria-hidden={duplicate || undefined} key={duplicate ? "duplicate" : "original"}>
                      {row.map(photo => (
                        <button className={styles.marqueePhoto} type="button" key={photo.id + (duplicate ? "-duplicate" : "")} tabIndex={duplicate ? -1 : undefined} onClick={() => setExpanded(photo)}>
                          <img src={mediaUrl(photo.id)} alt={duplicate ? "" : photo.caption || `Photograph from ${chapterTitle} shared by ${photo.contributorName}`} loading="lazy" />
                          <span>{photo.yearStart || photo.caption || "Open full photograph"}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className={styles.marqueeReducedGrid} aria-label={`Photograph album for ${chapterTitle}`}>
        {ordered.map(photo => <button type="button" key={photo.id} onClick={() => setExpanded(photo)}><img src={mediaUrl(photo.id)} alt={photo.caption || `Photograph from ${chapterTitle} shared by ${photo.contributorName}`} loading="lazy" /></button>)}
      </div>
      {expanded && <PhotoStoryViewer mediaId={expanded.id} src={mediaUrl(expanded.id)} alt={expanded.caption || expanded.originalName} onClose={() => { setExpanded(null); setTouchPaused(false); }} />}
    </section>
  );
}
