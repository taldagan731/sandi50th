"use client";

import { useEffect, useState } from "react";

const KEY = "sandi-film-motion";
const EVENT = "sandi-film-motion-change";

export function useFilmMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [explicitPlay, setExplicitPlay] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => {
      setReducedMotion(media.matches);
      setExplicitPlay(window.localStorage.getItem(KEY) === "play");
    };
    read();
    media.addEventListener("change", read);
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      media.removeEventListener("change", read);
      window.removeEventListener(EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const moving = !reducedMotion || explicitPlay;
  function toggle() {
    window.localStorage.setItem(KEY, moving ? "pause" : "play");
    window.dispatchEvent(new Event(EVENT));
  }

  return { moving, reducedMotion, toggle };
}
