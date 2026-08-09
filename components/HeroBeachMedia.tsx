"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type HeroBeachMediaProps = { className?: string; drift?: boolean; priority?: boolean };

export function HeroBeachMedia({ className = "", drift = false, priority = false }: HeroBeachMediaProps) {
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
    const video = videoRef.current;
    if (!video || !videoAllowed || videoFailed) return;
    video.play()?.catch(() => setVideoFailed(true));
  }, [videoAllowed, videoFailed]);

  const classes = ["heroBeachMedia", drift ? "heroBeachMedia--drift" : "", className].filter(Boolean).join(" ");
  return <div className={classes} aria-hidden="true">
    <Image className="heroBeachMediaStill celebrationHeroImage" src="/images/sandi-hero.jpeg" alt="" fill priority={priority} sizes="100vw" />
    {videoAllowed && !videoFailed ? <video ref={videoRef} className="heroBeachMediaVideo" data-playing={videoPlaying ? "true" : "false"} muted loop playsInline autoPlay preload="auto" poster="/images/sandi-hero.jpeg" tabIndex={-1} onPlaying={() => setVideoPlaying(true)} onError={() => setVideoFailed(true)} onStalled={() => setVideoPlaying(false)}><source src="/video/sandi-beach-waves.mp4" type="video/mp4" /></video> : null}
  </div>;
}