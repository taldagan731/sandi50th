"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./SeventiesTelevision.module.css";

const STATIC_DURATION_MS = 620;
const PICTURE_LOCK_MS = 505;

const programs = [
  { channel: 2, title: "The Bionic Woman", detail: "A new television phenomenon in 1976", scene: "bionic", image: "/images/birth-week/tv-bionic-woman.webp", imagePosition: "center center" },
  { channel: 4, title: "Little House on the Prairie", detail: "A family-room favorite on NBC", scene: "prairie", image: "/images/birth-week/tv-little-house.webp", imagePosition: "center center" },
  { channel: 5, title: "Happy Days", detail: "Milwaukee nostalgia and the Fonz", scene: "happyDays", image: "/images/birth-week/tv-happy-days.webp", imagePosition: "center 24%" },
  { channel: 7, title: "Wonder Woman", detail: "A comic-book heroine arrives in prime time", scene: "wonderWoman", image: "/images/birth-week/tv-wonder-woman.webp", imagePosition: "center 22%" },
  { channel: 9, title: "Charlie's Angels", detail: "Three detectives make their 1976 debut", scene: "charliesAngels", image: "/images/birth-week/tv-charlies-angels.webp", imagePosition: "center 18%" },
  { channel: 11, title: "The Muppet Show", detail: "Music, comedy, and backstage mayhem", scene: "muppets", image: "/images/birth-week/tv-muppet-show.webp", imagePosition: "center center" },
  { channel: 13, title: "Laverne & Shirley", detail: "Best friends, big laughs, and Milwaukee", scene: "laverneShirley", image: "/images/birth-week/tv-laverne-shirley.webp", imagePosition: "center 18%" }
] as const;

function canPlayStaticHiss() {
  if (window.localStorage.getItem("sandi-global-muted") === "true") return false;
  return !Array.from(document.querySelectorAll<HTMLMediaElement>("audio,video")).some(
    media => !media.paused && !media.muted && media.volume > 0
  );
}

function playStaticHiss() {
  if (!canPlayStaticHiss()) return;
  const AudioContextClass = window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const duration = 0.36;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    const envelope = Math.sin(Math.PI * index / samples.length);
    samples[index] = (Math.random() * 2 - 1) * envelope;
  }
  const source = context.createBufferSource();
  const highpass = context.createBiquadFilter();
  const gain = context.createGain();
  highpass.type = "highpass";
  highpass.frequency.value = 1250;
  gain.gain.value = 0.022;
  source.buffer = buffer;
  source.connect(highpass).connect(gain).connect(context.destination);

  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    window.removeEventListener("sandi:global-mute", onGlobalMute);
    window.dispatchEvent(new CustomEvent("sandi:external-audio", { detail: { active: false } }));
    void context.close();
  };
  const onGlobalMute = (event: Event) => {
    const detail = (event as CustomEvent<{ muted?: boolean }>).detail;
    if (detail?.muted) {
      try { source.stop(); } catch { /* already stopped */ }
    }
  };

  window.addEventListener("sandi:global-mute", onGlobalMute);
  window.dispatchEvent(new CustomEvent("sandi:external-audio", { detail: { active: true } }));
  source.start();
  source.onended = finish;
}

export function SeventiesTelevision() {
  const [active, setActive] = useState(0);
  const [displayed, setDisplayed] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [locking, setLocking] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timersRef = useRef<number[]>([]);
  const program = programs[displayed];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "120px" });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updatePageVisibility = () => setPageVisible(!document.hidden);
    updatePageVisibility();
    document.addEventListener("visibilitychange", updatePageVisibility);
    return () => document.removeEventListener("visibilitychange", updatePageVisibility);
  }, []);

  useEffect(() => () => timersRef.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    if (!transitioning || !visible || !pageVisible) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;
    canvas.width = 192;
    canvas.height = 144;
    const image = context.createImageData(canvas.width, canvas.height);
    let animationFrame = 0;
    let lastPaint = 0;

    const paint = (time: number) => {
      if (time - lastPaint > 32) {
        for (let index = 0; index < image.data.length; index += 4) {
          const value = 42 + Math.floor(Math.random() * 210);
          image.data[index] = value;
          image.data[index + 1] = value;
          image.data[index + 2] = value;
          image.data[index + 3] = 255;
        }
        context.putImageData(image, 0, 0);
        lastPaint = time;
      }
      animationFrame = requestAnimationFrame(paint);
    };
    animationFrame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(animationFrame);
  }, [pageVisible, transitioning, visible]);

  const changeChannel = useCallback((next: number) => {
    if (next === active || transitioning) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setActive(next);
    if (reducedMotion) {
      setDisplayed(next);
      return;
    }

    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    const channelImage = new window.Image();
    channelImage.src = programs[next].image;
    setTransitioning(true);
    setLocking(false);
    playStaticHiss();
    timersRef.current.push(window.setTimeout(() => {
      setDisplayed(next);
      setLocking(true);
    }, PICTURE_LOCK_MS));
    timersRef.current.push(window.setTimeout(() => {
      setTransitioning(false);
      setLocking(false);
    }, STATIC_DURATION_MS));
  }, [active, transitioning]);

  const nextChannel = () => changeChannel((active + 1) % programs.length);

  return (
    <section ref={sectionRef} className="seventiesTelevision" aria-labelledby="seventies-tv-title">
      <header>
        <span>ON THE AIR &middot; 1976</span>
        <h3 id="seventies-tv-title">Turn on the family-room television</h3>
        <p>A glimpse of what families were watching in the year Sandi was born.</p>
      </header>
      <div className={styles.tvWithHint}>
      <div className="retroTv">
        <Image className="retroTvPhoto" src="/images/birth-week/general-electric-portacolor-tv.webp" alt="A photographically accurate 1970s General Electric Porta-Color television with a curved glass screen and separate VHF and UHF channel dials" width={1400} height={1050} sizes="(max-width: 800px) 94vw, 650px" />
        <button className={'photoTvDial vhf ' + styles.physicalDial} type="button" data-band="VHF" aria-label="Turn the VHF channel dial" onClick={nextChannel} />
        <button className={'photoTvDial uhf ' + styles.physicalDial} type="button" data-band="UHF" aria-label="Turn the UHF channel dial" onClick={nextChannel} />
        <span className="photoTvChannelWindow" aria-hidden="true">{program.channel}</span>
        <div className={'retroTvScreen ' + styles.screen + (locking ? ' ' + styles.locking : '')} aria-live="polite">
          <div className={'retroTvFacade ' + styles.programFrame + ' ' + styles.photoFrame + ' ' + styles[program.scene]} role="img" aria-label={'Channel ' + program.channel + ': ' + program.title + '. ' + program.detail}>
            <span>TONIGHT &middot; CH {program.channel}</span>
            <img className={styles.programImage} src={program.image} alt="" aria-hidden="true" draggable={false} style={{ objectPosition: program.imagePosition }} />
            <strong>{program.title}</strong>
            <small>{program.detail}</small>
          </div>
          <canvas ref={canvasRef} className={styles.staticCanvas + (transitioning ? ' ' + styles.visible : '')} aria-hidden="true" />
          {transitioning && <div className={styles.rollBar} aria-hidden="true" />}
          <div className="retroTvGlass" aria-hidden="true" />
          <button className={styles.screenButton} type="button" onClick={nextChannel} disabled={transitioning} aria-label={"Change channel. Now showing " + program.title}><span>Click to change channel</span></button>
        </div>
        <div className="retroTvSpeaker" aria-hidden="true" />
        <div className="retroTvControls" aria-hidden="true" />
      </div>
      <p className={styles.interactionHint}><strong>Try the television:</strong> click the screen, turn either dial, or choose a channel.</p>
      </div>
      <nav className={'retroTvChannels ' + styles.channelControls} aria-label="1976 television programs">
        {programs.map((item, index) => (
          <button type="button" key={item.title} aria-pressed={active === index} onClick={() => changeChannel(index)} disabled={transitioning}>
            <span>CH {item.channel}</span><strong>{item.title}</strong><small>{item.detail}</small>
          </button>
        ))}
      </nav>
      <p className="tvHardwareCredit">Photographic reconstruction based on General Electric Porta-Color sets produced through the 1970s. Programme screens are original period-inspired artwork, not copyrighted television stills.</p>
    </section>
  );
}
