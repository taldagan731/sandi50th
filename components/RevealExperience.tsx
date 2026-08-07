"use client";

import { useMemo, useState } from "react";

type RevealMedia = {
  id: string;
  originalName: string;
  mimeType: string;
  caption: string;
  chapterNumber: number;
  poster: boolean;
};

type RevealChapter = {
  number: number;
  title: string;
  text: string;
};

export function RevealExperience({ chapters, media }: { chapters: RevealChapter[]; media: RevealMedia[] }) {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const chapter = chapters[chapterIndex];
  const chapterMedia = useMemo(
    () => media.filter(item => item.chapterNumber === chapter?.number),
    [media, chapter]
  );

  if (!chapters.length) {
    return (
      <section className="revealEmpty">
        <span className="eyebrow">STILL BECOMING</span>
        <h1>The approved story will appear here.</h1>
        <p>The private reveal remains empty until chapters are reviewed and approved in Story Studio.</p>
      </section>
    );
  }

  return (
    <div className="revealExperience">
      <header className="revealMasthead">
        <span className="eyebrow">A PRIVATE FILM AND LIVING ARCHIVE</span>
        <h1>Still Becoming</h1>
        <p>Fifty years, told by the people who love Sandi.</p>
      </header>

      <nav className="revealChapterNav" aria-label="Story chapters">
        {chapters.map((item, index) => (
          <button
            key={item.number}
            type="button"
            aria-current={index === chapterIndex ? "step" : undefined}
            onClick={() => {
              setChapterIndex(index);
              setActiveMediaId(null);
            }}
          >
            <span>{String(item.number).padStart(2, "0")}</span>
            <strong>{item.title}</strong>
          </button>
        ))}
      </nav>

      <article className="revealChapter" key={chapter.number}>
        <header>
          <span>CHAPTER {String(chapter.number).padStart(2, "0")}</span>
          <h2>{chapter.title}</h2>
        </header>
        <div className="revealProse">
          {chapter.text.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>

        {chapterMedia.length > 0 && (
          <section className="memoryCarousel" aria-label={`Memories for ${chapter.title}`}>
            <header>
              <span className="eyebrow">VOICES AND PHOTOGRAPHS</span>
              <p>Select a memory to bring it forward.</p>
            </header>
            <div className="memoryRail">
              {chapterMedia.map((item, index) => {
                const expanded = activeMediaId === item.id || (!activeMediaId && index === 0);
                const url = `/api/studio/media/${item.id}`;
                return (
                  <article
                    className={expanded ? "memoryPlate is-active" : "memoryPlate"}
                    key={item.id}
                  >
                    <button
                      className="memorySelect"
                      type="button"
                      aria-pressed={expanded}
                      onClick={() => setActiveMediaId(item.id)}
                    >
                      {expanded ? "Selected" : "Bring forward"}
                    </button>
                    {item.mimeType.startsWith("video/") ? (
                      <video controls={expanded} preload="metadata" poster={item.poster ? `${url}?poster=1` : undefined}>
                        <source src={url} type={item.mimeType} />
                      </video>
                    ) : item.mimeType.startsWith("audio/") ? (
                      <div className="revealAudio"><span>Listen to this memory</span><audio controls preload="metadata"><source src={url} type={item.mimeType} /></audio></div>
                    ) : item.mimeType === "image/heic" || item.mimeType === "image/heif" ? (
                      <div className="unsupportedPreview"><strong>Original iPhone photograph</strong><p>A JPEG presentation copy is still needed for this display.</p></div>
                    ) : item.mimeType.startsWith("image/") ? (
                      <img src={url} alt={item.caption || `A submitted memory: ${item.originalName}`} loading={index ? "lazy" : "eager"} />
                    ) : (
                      <a className="revealDocument" href={`${url}?download=1`}>Open {item.originalName}</a>
                    )}
                    <span>{item.caption || item.originalName}</span>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <footer className="revealChapterControls">
          <button type="button" disabled={chapterIndex === 0} onClick={() => setChapterIndex(index => Math.max(0, index - 1))}>Previous chapter</button>
          <span>{chapterIndex + 1} of {chapters.length}</span>
          <button type="button" disabled={chapterIndex === chapters.length - 1} onClick={() => setChapterIndex(index => Math.min(chapters.length - 1, index + 1))}>Next chapter</button>
        </footer>
      </article>
    </div>
  );
}
