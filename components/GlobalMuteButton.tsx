"use client";

import { useEffect, useRef, useState } from "react";

const EVENT = "sandi:global-mute";
const STORAGE_KEY = "sandi-global-muted";

export function GlobalMuteButton() {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const previous = useRef(new WeakMap<HTMLMediaElement, boolean>());

  function apply(next: boolean) {
    document.querySelectorAll<HTMLMediaElement>("audio, video").forEach(element => {
      if (next) {
        if (!previous.current.has(element)) previous.current.set(element, element.muted);
        element.muted = true;
      } else {
        element.muted = previous.current.get(element) ?? element.muted;
        previous.current.delete(element);
      }
    });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY) === "true";
      mutedRef.current = stored;
      setMuted(stored);
      apply(stored);
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { muted: stored } }));
    }, 0);

    const onMuteChange = (event: Event) => {
      const next = Boolean((event as CustomEvent<{ muted?: boolean }>).detail?.muted);
      mutedRef.current = next;
      setMuted(next);
      window.localStorage.setItem(STORAGE_KEY, String(next));
      apply(next);
    };
    const onPlay = (event: Event) => {
      if (!mutedRef.current || !(event.target instanceof HTMLMediaElement)) return;
      if (!previous.current.has(event.target)) previous.current.set(event.target, event.target.muted);
      event.target.muted = true;
    };

    window.addEventListener(EVENT, onMuteChange);
    document.addEventListener("play", onPlay, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(EVENT, onMuteChange);
      document.removeEventListener("play", onPlay, true);
    };
  }, []);

  function toggle() {
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    window.localStorage.setItem(STORAGE_KEY, String(next));
    apply(next);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { muted: next } }));
  }

  return <button className="globalMuteButton" type="button" aria-pressed={muted} aria-label={muted ? "Unmute all sound" : "Mute all sound"} onClick={toggle}><span aria-hidden="true">{muted ? "\u00D7" : "\u266A"}</span><strong>{muted ? "Sound off" : "Mute"}</strong></button>;
}