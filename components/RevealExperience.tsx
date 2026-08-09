"use client";

import Image from "next/image";
import { type CSSProperties, type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArchiveVideoStack, RevealTimeline, UnassignedArchive } from "@/components/RevealArchive";
import { RevealSoundtrack } from "@/components/RevealSoundtrackV2";
import { SandiSignaturePrelude } from "@/components/SandiSignaturePrelude";
import { FlowingCloudShader } from "@/components/FlowingCloudShader";
import { fireRevealFinaleConfetti } from "@/lib/confetti";
import { fireRevealFinaleBalloons, fireRevealOpeningBalloons } from "@/lib/balloons";

type RevealMedia = {
  id: string;
  originalName: string;
  mimeType: string;
  caption: string;
  chapterNumber: number | null;
  poster: boolean;
  contributorName: string;
  relationship: string;
  collection: "archive" | "voice" | "birthday" | "name";
  yearStart: number | null;
  yearEnd: number | null;
  yearSource: "contributor" | "exif" | "visual-decade" | null;
  displayOrder: number;
  testRecord: boolean;
};

type ExpandedPhoto = { src: string; alt: string };

type RevealChapter = {
  number: number;
  title: string;
  text: string;
};

type FamilyAnswer = {
  id: string;
  contributorName: string;
  relationship: string;
  question: string;
  answer: string;
  chapterNumber: number;
  when: string;
  place: string;
  chorusKeys: string[];
  photoAssetIds: string[];
  showInChapter: boolean;
};

type WrittenMemory = {
  id: string;
  chapterNumber: number;
  contributorName: string;
  relationship: string;
  firstMemory: string;
  story: string;
  when: string;
  place: string;
};

type ChorusGroup = {
  key: string;
  question: string;
  answers: FamilyAnswer[];
};

const CHORUS_QUESTIONS = [
  { key: "who-is-sandi", question: "Who is Sandi to you?" },
  { key: "what-do-you-admire", question: "What do you admire most about Sandi?" },
  { key: "what-makes-you-laugh", question: "What makes you laugh together?" }
] as const;

type RecordingCollectionProps = {
  items: RevealMedia[];
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
};

export function RevealExperience({ chapters, media, familyAnswers, writtenMemories }: { chapters: RevealChapter[]; media: RevealMedia[]; familyAnswers: FamilyAnswer[]; writtenMemories: WrittenMemory[] }) {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<ExpandedPhoto | null>(null);
  const [finaleSignal, setFinaleSignal] = useState(0);
  const [openingStarted, setOpeningStarted] = useState(false);
  const [rehearsalRuntime, setRehearsalRuntime] = useState<number | null>(null);
  const rehearsalStartedAt = useRef<number | null>(null);
  const chapter = chapters[chapterIndex];
  const archiveMedia = useMemo(() => media.filter(item => item.collection === "archive"), [media]);
  const voiceMemories = useMemo(
    () => media.filter(item => item.collection === "voice" && item.mimeType.startsWith("audio/")),
    [media]
  );
  const nameRecordings = useMemo(
    () => media.filter(item => item.collection === "name" && item.mimeType.startsWith("audio/")),
    [media]
  );
  const birthdayMessages = useMemo(
    () => media.filter(item => item.collection === "birthday" && (item.mimeType.startsWith("audio/") || item.mimeType.startsWith("video/"))),
    [media]
  );
  const reviewIncludesTests = media.some(item => item.testRecord);
  const archiveVideos = useMemo(
    () => archiveMedia.filter(item => item.mimeType.startsWith("video/")),
    [archiveMedia]
  );
  const chapterMedia = useMemo(
    () => media.filter(item => item.collection !== "name" && item.chapterNumber === chapter?.number),
    [media, chapter]
  );
  const chapterWrittenMemories = useMemo(
    () => writtenMemories.filter(item => item.chapterNumber === chapter?.number),
    [writtenMemories, chapter]
  );
  const chapterAnswers = useMemo(
    () => familyAnswers.filter(item => item.showInChapter && item.chapterNumber === chapter?.number),
    [familyAnswers, chapter]
  );
  const chorusGroups = useMemo(
    () => CHORUS_QUESTIONS.map(group => ({
      ...group,
      answers: familyAnswers.filter(answer => answer.chorusKeys.includes(group.key))
    })).filter(group => group.answers.length > 1),
    [familyAnswers]
  );
  const contributedMedia = useMemo(() => media.filter(item => item.collection !== "name"), [media]);
  const contributedTotal = contributedMedia.length + writtenMemories.length;

  useEffect(() => {
    if (!expandedPhoto) return;
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setExpandedPhoto(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [expandedPhoto]);

  function photoFromTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLImageElement) || target.dataset.revealPhoto !== "true") return null;
    return { src: target.currentSrc || target.src, alt: target.alt };
  }

  function handlePhotoClick(event: MouseEvent<HTMLDivElement>) {
    const photo = photoFromTarget(event.target);
    if (photo) setExpandedPhoto(photo);
  }

  function handlePhotoKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const photo = photoFromTarget(event.target);
    if (!photo) return;
    event.preventDefault();
    setExpandedPhoto(photo);
  }

  function startReveal() {
    setOpeningStarted(true);
    if (rehearsalStartedAt.current === null) rehearsalStartedAt.current = Date.now();
    fireRevealOpeningBalloons();
  }

  function completeRevealFinale() {
    setFinaleSignal(value => value + 1);
    if (rehearsalStartedAt.current === null) return;
    const elapsed = Date.now() - rehearsalStartedAt.current;
    setRehearsalRuntime(elapsed);
    window.localStorage.setItem("sandi-rehearsal-runtime-ms", String(elapsed));
  }
  function chooseChapter(index: number, scroll = false) {
    setChapterIndex(index);
    setActiveMediaId(null);
    setActiveRecordingId(null);
    if (scroll) {
      requestAnimationFrame(() => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document.getElementById("reveal-story-room")?.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start"
        });
      });
    }
  }

  if (!chapters.length && !familyAnswers.length && !writtenMemories.length && !voiceMemories.length && !birthdayMessages.length && !nameRecordings.length) {
    return (
      <section className="revealEmpty">
        <span className="eyebrow">STILL BECOMING</span>
        <h1>Her story is gathering here.</h1>
        <p>Contributions appear here as they arrive; the page remains private until August 11.</p>
      </section>
    );
  }

  return (
    <div className="revealExperience" onClick={handlePhotoClick} onKeyDown={handlePhotoKey}>
      {reviewIncludesTests && <aside className="testReviewBanner"><strong>Owner review mode</strong><span>Automated and test uploads are included and clearly marked. They remain excluded from real counts and the public reveal.</span></aside>}
      <header className="revealMasthead">
        <FlowingCloudShader palette="champagne" className="approvedPinkChampagneShader" />
        <Image
          className="revealMastheadPhoto"
          src="/images/sandi-hero.jpeg"
          alt="Sandi Yadegari, surrounded by the warmth and colour of her fiftieth-birthday story"
          fill
          priority
          sizes="100vw"
        />
        <div className="revealMastheadPhotoScrim" aria-hidden="true" />
        <SandiSignaturePrelude started={openingStarted} />
        <div className="revealMastheadContent">
          <span className="eyebrow">A BIRTHDAY FILM MADE BY HER PEOPLE</span>
          <h1>Still Becoming</h1>
          <p>Fifty years, told by the people who love Sandi.</p>
          <RevealSoundtrack ducked={activeRecordingId !== null} names={nameRecordings} finaleSignal={finaleSignal} onStart={startReveal} />
        </div>
      </header>

      <aside className="revealInventory" aria-label="Complete reveal inventory">
        <strong>{contributedTotal} contributions</strong>
        <span>{contributedMedia.filter(item => item.collection === "archive" && item.mimeType.startsWith("image/")).length} photographs</span>
        <span>{contributedMedia.filter(item => item.collection === "archive" && item.mimeType.startsWith("video/")).length} videos</span>
        <span>{voiceMemories.length} voice recording</span>
        <span>{birthdayMessages.length} birthday messages</span>
        <span>{writtenMemories.length} written memories</span>
        <span>{familyAnswers.length} family interview answers</span>
      </aside>

      {chapter && (
        <>
          <nav className="revealChapterNav" aria-label="Story chapters">
            {chapters.map((item, index) => (
              <button
                key={item.number}
                type="button"
                aria-current={index === chapterIndex ? "step" : undefined}
                onClick={() => chooseChapter(index)}
              >
                <span>{String(item.number).padStart(2, "0")}</span>
                <strong>{item.title}</strong>
              </button>
            ))}
          </nav>

          <article className="revealChapter" data-chapter={chapter.number} id="reveal-story-room" key={chapter.number}>
            <header>
              <span>CHAPTER {String(chapter.number).padStart(2, "0")}</span>
              <h2>{chapter.title}</h2>
              <p className="chapterInventory">{chapterMedia.length + chapterWrittenMemories.length} contributed items · {chapterAnswers.length} family answers</p>
            </header>
            <div className="revealProse">
              {chapter.text.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>

            {chapterWrittenMemories.length > 0 && <WrittenMemoryCollection items={chapterWrittenMemories} />}

            {chapterAnswers.length > 0 && <ChapterFamilyVoices answers={chapterAnswers} />}

            {chapterMedia.length > 0 && (
              <section className="memoryCarousel" aria-label={`Memories for ${chapter.title}`}>
                <header>
                  <span className="eyebrow">THE COMPLETE CHAPTER ARCHIVE</span>
                  <p>All {chapterMedia.length} contributed media items. Scroll to see every one.</p>
                </header>
                <div className="memoryRail">
                  {chapterMedia.map((item, index) => {
                    const expanded = activeMediaId === item.id || (!activeMediaId && index === 0);
                    const url = `/api/reveal/media/${item.id}`;
                    return (
                      <article className={`${expanded ? "memoryPlate is-active" : "memoryPlate"}${item.testRecord ? " is-test-record" : ""}`} key={item.id}>
                        {item.testRecord && <b className="testRecordBadge">TEST â€” EXCLUDE</b>}
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

      {archiveMedia.length > 0 && (
        <RevealTimeline
          items={archiveMedia}
          chapters={chapters}
          onChapterSelect={chapterNumber => {
            const index = chapters.findIndex(item => item.number === chapterNumber);
            if (index >= 0) chooseChapter(index, true);
          }}
        />
      )}

      {archiveMedia.some(item => !item.chapterNumber) && <UnassignedArchive items={archiveMedia.filter(item => !item.chapterNumber)} />}

      {archiveVideos.length > 0 && <ArchiveVideoStack items={archiveVideos} />}

      {chorusGroups.length > 0 && <FamilyChorus groups={chorusGroups} />}

      {voiceMemories.length > 0 && (
        <VoiceWall items={voiceMemories} activeId={activeRecordingId} onActiveChange={setActiveRecordingId} />
      )}

      {birthdayMessages.length > 0 && (
        <BirthdayMessageReel items={birthdayMessages} activeId={activeRecordingId} onActiveChange={setActiveRecordingId} onFinale={completeRevealFinale} />
      )}


      {rehearsalRuntime !== null && (
        <aside className="rehearsalRuntime" role="status">
          <span>FULL REHEARSAL RUNTIME</span>
          <strong>{Math.floor(rehearsalRuntime / 60000)}:{String(Math.floor((rehearsalRuntime % 60000) / 1000)).padStart(2, "0")}</strong>
          <p>Measured from the first press of Play to the final balloons and confetti on this device.</p>
        </aside>
      )}
      {expandedPhoto && <PhotoFocus photo={expandedPhoto} onClose={() => setExpandedPhoto(null)} />}

      <section className="chapterNineInvitation" aria-labelledby="chapter-nine-title">
        <div className="chapterNineInner">
          <span className="eyebrow">STILL BECOMING</span>
          <div className="chapterNineNumber">CHAPTER 09</div>
          <h2 id="chapter-nine-title">The rest is yours to write.</h2>
          <p>Fifty is a beginning hiding in plain sight. This room is yours—for what you want next, what surprises you, and every chapter still waiting to become real.</p>
          <p>Whenever you are ready, start anywhere.</p>
          <div className="chapterNineRule" aria-hidden="true" />
        </div>
      </section>
    </div>
  );
}

function ChapterFamilyVoices({ answers }: { answers: FamilyAnswer[] }) {
  return (
    <section className="chapterFamilyVoices" aria-label="Family voices in this chapter">
      <header>
        <span className="eyebrow">IN THEIR WORDS</span>
        <p>Stories and observations from the people who know this side of Sandi.</p>
      </header>
      <div>
        {answers.map(answer => (
          <figure key={answer.id} className={answer.photoAssetIds.length ? "familyVoice hasPhoto" : "familyVoice"}>
            {answer.photoAssetIds.length > 0 && (
              <div className="familyVoicePhotos">
                {answer.photoAssetIds.map(photoId => (
                  <img key={photoId} src={`/api/reveal/media/${photoId}`} alt={`Photograph linked to ${answer.contributorName}’s memory of Sandi`} loading="lazy" data-reveal-photo="true" role="button" tabIndex={0} />
                ))}
              </div>
            )}
            <div>
              <p className="familyVoiceQuestion">{answer.question}</p>
              <blockquote>{answer.answer}</blockquote>
              <figcaption>
                <strong>{answer.contributorName}</strong>
                <span>{answer.relationship}</span>
                {(answer.when || answer.place) && <small>{[answer.when, answer.place].filter(Boolean).join(" · ")}</small>}
              </figcaption>
            </div>
          </figure>
        ))}
      </div>
    </section>
  );
}

function WrittenMemoryCollection({ items }: { items: WrittenMemory[] }) {
  return (
    <section className="writtenMemoryCollection" aria-label="Written memories in this chapter">
      <header><span className="eyebrow">WRITTEN BY HER PEOPLE</span><p>Every submitted written memory assigned to this chapter.</p></header>
      <div>
        {items.map(item => (
          <figure key={item.id} className="writtenMemoryCard">
            {item.firstMemory && <><small>FIRST MEMORY</small><blockquote>{item.firstMemory}</blockquote></>}
            {item.story && <p>{item.story}</p>}
            <figcaption>
              <strong>{item.contributorName}</strong>
              {item.relationship && <span>{item.relationship}</span>}
              {(item.when || item.place) && <small>{[item.when, item.place].filter(Boolean).join(" · ")}</small>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function FamilyChorus({ groups }: { groups: ChorusGroup[] }) {
  const [groupIndex, setGroupIndex] = useState(0);
  const [answerIndex, setAnswerIndex] = useState(0);
  const group = groups[Math.min(groupIndex, groups.length - 1)];
  const answer = group.answers[Math.min(answerIndex, group.answers.length - 1)];

  function chooseGroup(nextIndex: number) {
    setGroupIndex(nextIndex);
    setAnswerIndex(0);
  }

  function move(delta: number) {
    setAnswerIndex(current => Math.min(group.answers.length - 1, Math.max(0, current + delta)));
  }

  return (
    <section className="familyChorus" aria-labelledby="family-chorus-title">
      <header>
        <span className="eyebrow">A CHORUS</span>
        <h2 id="family-chorus-title">The same question. A different way of seeing her.</h2>
        <p>One voice at a time, from family members who each see something wonderfully different in Sandi.</p>
      </header>

      <nav aria-label="Chorus questions">
        {groups.map((item, index) => (
          <button type="button" key={item.key} aria-pressed={index === groupIndex} onClick={() => chooseGroup(index)}>
            {item.question}
          </button>
        ))}
      </nav>

      <div className="chorusStage" aria-live="polite">
        <p className="chorusQuestion">{group.question}</p>
        <figure key={answer.id}>
          {answer.photoAssetIds.length > 0 && (
            <img src={`/api/reveal/media/${answer.photoAssetIds[0]}`} alt={`Photograph linked to ${answer.contributorName}’s answer about Sandi`} loading="lazy" data-reveal-photo="true" role="button" tabIndex={0} />
          )}
          <div>
            <blockquote>{answer.answer}</blockquote>
            <figcaption><strong>{answer.contributorName}</strong><span>{answer.relationship}</span></figcaption>
          </div>
        </figure>
        <div className="chorusTransport">
          <button type="button" disabled={answerIndex === 0} onClick={() => move(-1)}>Previous voice</button>
          <span>{answerIndex + 1} of {group.answers.length}</span>
          <button type="button" disabled={answerIndex === group.answers.length - 1} onClick={() => move(1)}>Next voice</button>
        </div>
      </div>
    </section>
  );
}

function VoiceWall({ items, activeId, onActiveChange }: RecordingCollectionProps) {
  return (
    <section className="voiceWall" aria-labelledby="voice-wall-title">
      <header className="recordingCollectionHeader">
        <span className="eyebrow">THE VOICE WALL</span>
        <h2 id="voice-wall-title">A story sounds better in the voices that know her.</h2>
        <p>These stories come from people who know her laugh, her timing, and the details that never fit neatly on a page.</p>
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
    <article className={`${playing ? "voiceCard is-playing" : "voiceCard"}${item.testRecord ? " is-test-record" : ""}`}>
      {item.testRecord && <b className="testRecordBadge">TEST â€” EXCLUDE</b>}
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

function BirthdayMessageReel({ items, activeId, onActiveChange, onFinale }: RecordingCollectionProps & { onFinale: () => void }) {
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
      fireRevealFinaleBalloons();
      onFinale();
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
        <div className={`${mediaClass}${current.testRecord ? " is-test-record" : ""}`}>
          {current.testRecord && <b className="testRecordBadge">TEST â€” EXCLUDE</b>}
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


function PhotoFocus({ photo, onClose }: { photo: ExpandedPhoto; onClose: () => void }) {
  return (
    <div className="photoFocus" role="dialog" aria-modal="true" aria-label="Expanded photograph" onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Close expanded photograph">Close</button>
      <img src={photo.src} alt={photo.alt} onClick={event => event.stopPropagation()} />
    </div>
  );
}

function RevealImage({ item, url, eager }: { item: RevealMedia; url: string; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="unsupportedPreview">
        <strong>A photograph belongs here</strong>
        <p>This memory is being prepared for the celebration.</p>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={item.caption || `A submitted memory: ${item.originalName}`}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
      data-reveal-photo="true"
      role="button"
      tabIndex={0}
      aria-label={`Expand photograph: ${item.caption || item.originalName}`}
    />
  );
}
