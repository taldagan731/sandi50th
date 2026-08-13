"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type HeroBeachMediaProps = { className?: string; drift?: boolean; priority?: boolean };

export function HeroBeachMedia({ className = "", drift = false, priority = false }: HeroBeachMediaProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoAllowed, setVideoAllowed] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const allowed = !preference.matches;
      setVideoAllowed(allowed);
      if (!allowed) { videoRef.current?.pause(); setVideoPlaying(false); }
    };
    update();
    preference.addEventListener?.("change", update);
    return () => preference.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    const video = videoRef.current;
    if (!shell || !video || !videoAllowed || videoFailed) return;
    let visible = true;
    const sync = () => {
      if (!visible || document.hidden) { video.pause(); return; }
      video.play()?.catch(() => setVideoFailed(true));
    };
    const observer = new IntersectionObserver(entries => {
      visible = Boolean(entries[0]?.isIntersecting);
      sync();
    }, { rootMargin: "80px" });
    const visibility = () => sync();
    observer.observe(shell);
    document.addEventListener("visibilitychange", visibility);
    sync();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, [videoAllowed, videoFailed]);

  const classes = ["heroBeachMedia", drift ? "heroBeachMedia--drift" : "", className].filter(Boolean).join(" ");
  return <div ref={shellRef} className={classes} aria-hidden="true">
    <Image className="heroBeachMediaStill celebrationHeroImage" src="/images/sandi-hero.jpeg" alt="" fill priority={priority} sizes="100vw" />
    {videoAllowed && !videoFailed ? <video ref={videoRef} className="heroBeachMediaVideo" data-playing={videoPlaying ? "true" : "false"} muted loop playsInline autoPlay preload="auto" poster="/images/sandi-hero-poster.jpg" tabIndex={-1} onPlaying={() => setVideoPlaying(true)} onError={() => setVideoFailed(true)} onStalled={() => setVideoPlaying(false)}><source src="/video/sandi-beach-waves.mp4" type="video/mp4" /></video> : null}
  </div>;
}