"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { ArchiveVideoStack, RevealTimeline } from "@/components/RevealArchive";
import { fireRevealFinaleConfetti } from "@/lib/confetti";

type RevealMedia = {
  id: string;
  originalName: string;
  mimeType: string;
  caption: string;
  chapterNumber: number | null;
  poster: boolean;
  contributorName: string;
  relationship: string;
  collection: "archive" | "voice" | "birthday";
  yearStart: number | null;
  yearEnd: number | null;
  yearSource: "contributor" | "exif" | "visual-decade" | null;
};

type RevealChapter = {
  number: number;
  title: string;
  text: string;
};

type RecordingCollectionProps = {
  items: RevealMedia[];
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
};

export function RevealExperience({ chapters, media }: { chapters: RevealChapter[]; media: RevealMedia[] }) {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const chapter = chapters[chapterIndex];
  const archiveMedia = useMemo(() => media.filter(item => item.collection === "archive"), [media]);
  const voiceMemories = useMemo(
    () => media.filter(item => item.collection === "voice" && item.mimeType.startsWith("audio/")),
    [media]
  );
  const birthdayMessages = useMemo(
    () => media.filter(item => item.collection === "birthday" && (item.mimeType.startsWith("audio/") || item.mimeType.startsWith("video/"))),
    [media]
  );
  const archiveVideos = useMemo(
    () => archiveMedia.filter(item => item.mimeType.startsWith("video/")),
    [archiveMedia]
  );
  const chapterMedia = useMemo(
    () => archiveMedia.filter(item => item.chapterNumber === chapter?.number && !item.mimeType.startsWith("video/")),
    [archiveMedia, chapter]
  );

  if (!chapters.length && !voiceMemories.length && !birthdayMessages.length) {
    return (
      <section className="revealEmpty">
        <span className="eyebrow">STILL BECOMING</span>
        <h1>Her story is gathering here.</h1>
        <p>Contributions appear here as they arrive; the page remains private until August 11.</p>
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

      {chapter && (
        <>
          <nav className="revealChapterNav" aria-label="Story chapters">
            {chapters.map((item, index) => (
              <button
                key={item.number}
                type="button"
                aria-current={index === chapterIndex ? "step" : undefined}
                onClick={() => {
                  setChapterIndex(index);
                  setActiveMediaId(null);
                  setActiveRecordingId(null);
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
                    const url = `/api/reveal/media/${item.id}`;
                    return (
                      <article className={expanded ? "memoryPlate is-active" : "memoryPlate"} key={item.id}>
                        <button className="memorySelect" type="button" aria-pressed={expanded} onClick={() => setActiveMediaId(item.id)}>
                          {expanded ? "Selected" : "Bring forward"}
                        </button>
                        {item.mimeType.startsWith("video/") ? (
                          <video controls={expanded} preload="metadata" playsInline poster={item.poster ? `${url}?poster=1` : undefined}>
                            <source src={url} type={item.mimeType} />
                          </video>
                        ) : item.mimeType.startsWith("audio/") ? (
                          <div className="revealAudio"><span>Listen to this memory</span><audio controls preload="metadata"><source src={url} type={item.mimeType} /></audio></div>
                        ) : item.mimeType.startsWith("image/") ? (
                          <RevealImage item={item} url={url} eager={index === 0} />
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
        </>
      )}

      {archiveMedia.length > 0 && <RevealTimeline items={archiveMedia} chapters={chapters} />}

      {archiveVideos.length > 0 && <ArchiveVideoStack items={archiveVideos} />}

      {voiceMemories.length > 0 && (
        <VoiceWall items={voiceMemories} activeId={activeRecordingId} onActiveChange={setActiveRecordingId} />
      )}

      {birthdayMessages.length > 0 && (
        <BirthdayMessageReel items={birthdayMessages} activeId={activeRecordingId} onActiveChange={setActiveRecordingId} />
      )}

      <section className="chapterNineInvitation" aria-labelledby="chapter-nine-title">
        <div className="chapterNineInner">
          <span className="eyebrow">STILL BECOMING</span>
          <div className="chapterNineNumber">CHAPTER 09</div>
          <h2 id="chapter-nine-title">The rest is yours to write.</h2>
          <p>This story arrives at fifty without closing. It holds what the people who love you can see, and leaves room for everything only you can choose next.</p>
          <p>Whenever you are ready, this chapter belongs to you.</p>
          <div className="chapterNineRule" aria-hidden="true" />
        </div>
      </section>
    </div>
  );
}

function VoiceWall({ items, activeId, onActiveChange }: RecordingCollectionProps) {
  return (
    <section className="voiceWall" aria-labelledby="voice-wall-title">
      <header className="recordingCollectionHeader">
        <span className="eyebrow">THE VOICE WALL</span>
        <h2 id="voice-wall-title">A story sounds different in the voices that lived it.</h2>
        <p>These memories were spoken for Sandi by the people who know the pauses, the laughter, and the details that never fit neatly on a page.</p>
      </header>
      <div className="voiceWallGrid">
        {items.map((item, index) => (
          <VoiceCard key={item.id} item={item} number={index + 1} activeId={activeId} onActiveChange={onActiveChange} />
        ))}
      </div>
    </section>
  );
}

function VoiceCard({ item, number, activeId, onActiveChange }: {
  item: RevealMedia;
  number: number;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackId = `voice:${item.id}`;
  const playing = activeId === playbackId;

  useEffect(() => {
    if (!playing && audioRef.current && !audioRef.current.paused) audioRef.current.pause();
  }, [playing]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      onActiveChange(null);
      return;
    }
    onActiveChange(playbackId);
    try {
      await audio.play();
    } catch {
      onActiveChange(null);
    }
  }

  return (
    <article className={playing ? "voiceCard is-playing" : "voiceCard"}>
      <div className="voiceCardTopline"><span>{String(number).padStart(2, "0")}</span><span>{item.relationship || "Someone who loves Sandi"}</span></div>
      <Waveform />
      <h3>{item.contributorName}</h3>
      {item.caption && <p>{item.caption}</p>}
      <button type="button" aria-pressed={playing} onClick={toggle}>{playing ? "Pause memory" : "Play memory"}</button>
      <audio ref={audioRef} preload="metadata" onEnded={() => onActiveChange(null)}>
        <source src={`/api/reveal/media/${item.id}`} type={item.mimeType} />
      </audio>
    </article>
  );
}

function BirthdayMessageReel({ items, activeId, onActiveChange }: RecordingCollectionProps) {
  const [index, setIndex] = useState(0);
  const [continuePlaying, setContinuePlaying] = useState(false);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const sequenceStartedAtFirst = useRef(false);
  const finaleFired = useRef(false);
  const current = items[index];
  const playbackId = `birthday:${current.id}`;
  const playing = activeId === playbackId;

  useEffect(() => {
    const mediaElement = mediaRef.current;
    if (!mediaElement) return;
    if (playing) {
      void mediaElement.play().catch(() => {
        setContinuePlaying(false);
        onActiveChange(null);
      });
    } else if (!mediaElement.paused) {
      mediaElement.pause();
    }
  }, [playing, playbackId, onActiveChange]);

  useEffect(() => {
    if (continuePlaying) onActiveChange(playbackId);
  }, [continuePlaying, playbackId, onActiveChange]);

  function select(nextIndex: number) {
    onActiveChange(null);
    sequenceStartedAtFirst.current = false;
    setContinuePlaying(false);
    setIndex(nextIndex);
  }

  function toggle() {
    const element = mediaRef.current;
    if (!element) return;
    if (playing) {
      element.pause();
      setContinuePlaying(false);
      onActiveChange(null);
      return;
    }
    if (index === 0) sequenceStartedAtFirst.current = true;
    setContinuePlaying(true);
    onActiveChange(playbackId);
    void element.play().catch(() => {
      setContinuePlaying(false);
      onActiveChange(null);
    });
  }

  function handleEnded() {
    if (continuePlaying && index < items.length - 1) {
      setIndex(value => value + 1);
      return;
    }
    if (continuePlaying && sequenceStartedAtFirst.current && !finaleFired.current) {
      finaleFired.current = true;
      fireRevealFinaleConfetti();
    }
    setContinuePlaying(false);
    onActiveChange(null);
  }

  const mediaUrl = `/api/reveal/media/${current.id}`;
  const mediaClass = `${current.mimeType.startsWith("video/") ? "birthdayMedia birthdayVideo" : "birthdayMedia birthdayAudio"}${playing ? " is-playing" : ""}`;
  return (
    <section className="birthdayReel" aria-labelledby="birthday-reel-title">
      <header className="recordingCollectionHeader">
        <span className="eyebrow">ONE MORE CHAPTER, SPOKEN TO HER</span>
        <h2 id="birthday-reel-title">Sandi, this part is for you.</h2>
        <p>The story has reached the present. These messages were recorded for this birthday, addressed to you by the people who wanted to be in the room.</p>
      </header>

      <div className="birthdayStage" aria-live="polite">
        <div className={mediaClass}>
          {current.mimeType.startsWith("video/") ? (
            <video
              ref={node => { mediaRef.current = node; }}
              preload="metadata"
              playsInline
              poster={current.poster ? `${mediaUrl}?poster=1` : undefined}
              onEnded={handleEnded}
            >
              <source src={mediaUrl} type={current.mimeType} />
            </video>
          ) : (
            <div className="birthdayAudioPortrait">
              <Waveform large />
              <audio ref={node => { mediaRef.current = node; }} preload="metadata" onEnded={handleEnded}>
                <source src={mediaUrl} type={current.mimeType} />
              </audio>
            </div>
          )}
          <div className="birthdayLowerThird">
            <strong>{current.contributorName}</strong>
            <span>{current.relationship || "Someone who loves Sandi"}</span>
          </div>
        </div>

        <div className="birthdayTransport">
          <button type="button" disabled={index === 0} onClick={() => select(Math.max(0, index - 1))}>Previous</button>
          <button className="birthdayPlay" type="button" aria-pressed={playing} onClick={toggle}>
            {playing ? "Pause message" : index === 0 ? "Play the messages" : "Play message"}
          </button>
          <button type="button" disabled={index === items.length - 1} onClick={() => select(Math.min(items.length - 1, index + 1))}>Next</button>
        </div>
        <p className="birthdayPosition">Message {index + 1} of {items.length}</p>
      </div>

      <nav className="birthdayQueue" aria-label="Birthday messages">
        {items.map((item, itemIndex) => (
          <button type="button" key={item.id} aria-current={itemIndex === index ? "true" : undefined} onClick={() => select(itemIndex)}>
            <span>{String(itemIndex + 1).padStart(2, "0")}</span>
            <strong>{item.contributorName}</strong>
            <small>{item.relationship}</small>
          </button>
        ))}
      </nav>
    </section>
  );
}

function Waveform({ large = false }: { large?: boolean }) {
  const bars = Array.from({ length: large ? 42 : 28 }, (_, index) => {
    const height = 24 + ((index * 37) % 68);
    const style = {
      "--wave-height": `${height}%`,
      "--wave-delay": `${(index % 9) * -0.08}s`
    } as CSSProperties;
    return <span key={index} style={style} />;
  });
  return <div className={large ? "voiceWave is-large" : "voiceWave"} aria-hidden="true">{bars}</div>;
}


function RevealImage({ item, url, eager }: { item: RevealMedia; url: string; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="unsupportedPreview">
        <strong>Original iPhone photograph preserved</strong>
        <p>This browser cannot display the HEIC original. Review it in Safari or add a JPEG presentation copy.</p>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={item.caption || `A submitted memory: ${item.originalName}`}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
}
