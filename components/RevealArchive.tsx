"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

export type ArchiveMedia = {
  id: string;
  originalName: string;
  mimeType: string;
  caption: string;
  chapterNumber: number | null;
  poster: boolean;
  contributorName: string;
  relationship: string;
  yearStart: number | null;
  yearEnd: number | null;
  yearSource: "contributor" | "exif" | "visual-decade" | null;
};

type Chapter = { number: number; title: string; text: string };

const START_YEAR = 1976;
const END_YEAR = 2026;
const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, index) => START_YEAR + index);

function midpoint(item: ArchiveMedia) {
  if (!item.yearStart) return null;
  return Math.round((item.yearStart + (item.yearEnd ?? item.yearStart)) / 2);
}

function dateLabel(item: ArchiveMedia) {
  if (!item.yearStart) return "Date not yet placed";
  const range = item.yearEnd && item.yearEnd !== item.yearStart
    ? `${item.yearStart}–${item.yearEnd}`
    : String(item.yearStart);
  if (item.yearSource === "exif") return `${range} · from the original photograph`;
  if (item.yearSource === "contributor") return `${range} · supplied with the memory`;
  return `${range} · approximate range`;
}

export function RevealTimeline({
  items,
  chapters,
  onChapterSelect
}: {
  items: ArchiveMedia[];
  chapters: Chapter[];
  onChapterSelect?: (chapterNumber: number) => void;
}) {
  const dated = useMemo(
    () => items.filter(item => item.yearStart && (item.mimeType.startsWith("image/") || item.mimeType.startsWith("video/"))),
    [items]
  );
  const initialYear = useMemo(() => {
    const years = dated.map(midpoint).filter((value): value is number => value !== null);
    return years.length ? Math.min(...years) : START_YEAR;
  }, [dated]);
  const [year, setYear] = useState(initialYear);

  const density = useMemo(() => YEARS.map(candidate => dated.filter(item => {
    const start = item.yearStart ?? candidate + 1;
    const end = item.yearEnd ?? start;
    return candidate >= start && candidate <= end;
  }).length), [dated]);
  const maxDensity = Math.max(1, ...density);
  const direct = dated.filter(item => year >= (item.yearStart ?? END_YEAR + 1) && year <= (item.yearEnd ?? item.yearStart ?? START_YEAR - 1));
  const visible = direct.length
    ? direct.slice(0, 8)
    : [...dated]
        .sort((a, b) => Math.abs((midpoint(a) ?? END_YEAR) - year) - Math.abs((midpoint(b) ?? END_YEAR) - year))
        .slice(0, 4);

  if (!dated.length) {
    return (
      <section className="lifeTimeline timelineEmpty" aria-labelledby="timeline-title">
        <span className="eyebrow">A LIFE IN TIME</span>
        <h2 id="timeline-title">The years will gather here.</h2>
        <p>Photographs appear on this timeline as soon as a contributor date or an approximate range is available.</p>
      </section>
    );
  }

  return (
    <section className="lifeTimeline" aria-labelledby="timeline-title">
      <header>
        <span className="eyebrow">A LIFE IN TIME</span>
        <h2 id="timeline-title">Move through the years.</h2>
        <p>Exact dates come from contributors or the original file. Soft ranges remain ranges; the archive never turns uncertainty into a false date.</p>
      </header>

      <div className="timelineControl">
        <div className="timelineYear" aria-live="polite"><span>YEAR</span><strong>{year}</strong></div>
        <div className="densityRail" aria-hidden="true">
          {density.map((count, index) => (
            <span key={YEARS[index]} style={{ "--density": Math.max(.08, count / maxDensity) } as CSSProperties} />
          ))}
        </div>
        <input
          aria-label={`Move through Sandi's timeline. Selected year ${year}`}
          type="range"
          min={START_YEAR}
          max={END_YEAR}
          step="1"
          value={year}
          onChange={event => setYear(Number(event.target.value))}
        />
        <div className="timelineEndpoints" aria-hidden="true"><span>{START_YEAR}</span><span>{END_YEAR}</span></div>
      </div>

      <nav className="timelineChapters" aria-label="Narrative chapters">
        {chapters.map(chapter => (
          <button
            key={chapter.number}
            type="button"
            onClick={() => onChapterSelect?.(chapter.number)}
          >
            <small>{String(chapter.number).padStart(2, "0")}</small>
            {chapter.title}
          </button>
        ))}
      </nav>

      {!direct.length && <p className="timelineNearest">No item is dated to {year} exactly. Showing the nearest dated memories.</p>}
      <div className="timelineMemories" key={year}>
        {visible.map(item => {
          const url = `/api/reveal/media/${item.id}`;
          return (
            <article key={item.id}>
              <div className="timelineImage">
                {item.mimeType.startsWith("video/") ? (
                  <InViewVideoPreview item={item} url={url} />
                ) : (
                  <img src={url} alt={item.caption || `A submitted memory from ${item.contributorName}`} loading="lazy" data-reveal-photo="true" role="button" tabIndex={0} />
                )}
                {item.mimeType.startsWith("video/") && <span>FILM</span>}
              </div>
              <p>{item.caption || item.originalName}</p>
              <small>{dateLabel(item)}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function InViewVideoPreview({ item, url }: { item: ArchiveMedia; url: string }) {
  const previewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = previewRef.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .55);
      if (visible && document.visibilityState === "visible") {
        video.muted = true;
        video.loop = true;
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    }, { threshold: [.55], rootMargin: "0px 0px -8% 0px" });
    const pauseWhenHidden = () => {
      if (document.visibilityState !== "visible") video.pause();
    };
    observer.observe(video);
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      video.pause();
    };
  }, []);

  return (
    <video
      ref={previewRef}
      className="timelineVideoPreview"
      muted
      loop
      playsInline
      preload="metadata"
      poster={item.poster ? `${url}?poster=1` : undefined}
      aria-label={`Silent preview of ${item.caption || item.originalName}`}
    >
      <source src={url} type={item.mimeType} />
    </video>
  );
}

export function ArchiveVideoStack({ items }: { items: ArchiveMedia[] }) {
  const [index, setIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .7);
      if (visible) {
        video.muted = true;
        video.loop = true;
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    }, { threshold: [.7] });
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [index]);
  if (!items.length) return null;
  const current = items[index];
  const currentUrl = `/api/reveal/media/${current.id}`;

  function select(next: number) {
    videoRef.current?.pause();
    setIndex(next);
  }

  return (
    <section className="archiveFilmStack" id="archive-films" aria-labelledby="archive-films-title">
      <header>
        <span className="eyebrow">THE FILM ARCHIVE</span>
        <h2 id="archive-films-title">Press play on the good parts.</h2>
        <p>Home movies and shared clips bring the room to life. Choose one, turn up the sound, and let it play.</p>
      </header>

      <div className="filmStackStage">
        <div className="filmStack" aria-hidden="true">
          {items.slice(0, 7).map((item, itemIndex) => {
            const actualIndex = (index + itemIndex) % items.length;
            const stackItem = items[actualIndex];
            const style = { "--stack-index": itemIndex } as CSSProperties;
            return stackItem.poster
              ? <img key={`${stackItem.id}-${itemIndex}`} src={`/api/reveal/media/${stackItem.id}?poster=1`} alt="" style={style} />
              : <span key={`${stackItem.id}-${itemIndex}`} style={style} />;
          })}
        </div>

        <article className="filmPlayer" key={current.id}>
          <video ref={videoRef} controls muted loop preload="metadata" playsInline poster={current.poster ? `${currentUrl}?poster=1` : undefined}>
            <source src={currentUrl} type={current.mimeType} />
          </video>
          <div>
            <span>{current.contributorName}{current.relationship ? ` · ${current.relationship}` : ""}</span>
            <h3>{current.caption || current.originalName}</h3>
            <small>{dateLabel(current)}</small>
          </div>
        </article>
      </div>

      <div className="filmStackControls">
        <button type="button" disabled={index === 0} onClick={() => select(Math.max(0, index - 1))}>Previous film</button>
        <span>{index + 1} of {items.length}</span>
        <button type="button" disabled={index === items.length - 1} onClick={() => select(Math.min(items.length - 1, index + 1))}>Next film</button>
      </div>
      <nav className="filmQueue" aria-label="Archive films">
        {items.map((item, itemIndex) => (
          <button key={item.id} type="button" aria-current={itemIndex === index ? "true" : undefined} onClick={() => select(itemIndex)}>
            <span>{String(itemIndex + 1).padStart(2, "0")}</span>
            <strong>{item.contributorName}</strong>
          </button>
        ))}
      </nav>
    </section>
  );
}
