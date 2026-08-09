"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type HeroBeachMediaProps = { className?: string; drift?: boolean; priority?: boolean };

export function HeroBeachMedia({ className = "", drift = false, priority = false }: HeroBeachMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoFailed) return;
    let cancelled = false;
    function attemptAutoplay() {
      if (!video || cancelled) return;
      video.defaultMuted = true;
      video.muted = true;
      const attempt = video.play();
      if (!attempt) return;
      void attempt
        .then(() => {
          if (!cancelled) setVideoPlaying(true);
        })
        .catch(() => {
          if (!cancelled && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            setVideoPlaying(false);
            setVideoFailed(true);
          }
        });
    }
    attemptAutoplay();
    video.addEventListener("canplay", attemptAutoplay, { once: true });
    return () => {
      cancelled = true;
      video.removeEventListener("canplay", attemptAutoplay);
    };
  }, [videoFailed]);

  const classes = ["heroBeachMedia", drift ? "heroBeachMedia--drift" : "", className].filter(Boolean).join(" ");
  return <div className={classes} aria-hidden="true">
    <Image className="heroBeachMediaStill celebrationHeroImage" src="/images/sandi-hero.jpeg" alt="" fill priority={priority} sizes="100vw" />
    {!videoFailed ? <video ref={videoRef} className="heroBeachMediaVideo" data-playing={videoPlaying ? "true" : "false"} muted={true} autoPlay={true} loop={true} playsInline={true} preload="auto" poster="/images/sandi-hero.jpeg" tabIndex={-1} disablePictureInPicture onPlaying={() => setVideoPlaying(true)} onPause={() => setVideoPlaying(false)} onError={() => setVideoFailed(true)} onStalled={() => setVideoPlaying(false)}><source src="/video/sandi-beach-waves.mp4" type="video/mp4" /></video> : null}
  </div>;
}