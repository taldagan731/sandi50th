"use client";

import { useEffect, useState } from "react";
import { MUSIC_MUTE_EVENT, MUSIC_MUTE_STORAGE_KEY, type MusicMuteEventDetail } from "@/lib/music-preference";

function savedPreference() {
  try { return window.localStorage.getItem(MUSIC_MUTE_STORAGE_KEY) === "true"; }
  catch { return false; }
}

export function GlobalMusicMuteButton() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(savedPreference());
    const sync = (event: StorageEvent) => {
      if (event.key === MUSIC_MUTE_STORAGE_KEY) setMuted(event.newValue === "true");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function toggleMusic() {
    const next = !muted;
    setMuted(next);
    try { window.localStorage.setItem(MUSIC_MUTE_STORAGE_KEY, String(next)); } catch {}
    window.dispatchEvent(new CustomEvent<MusicMuteEventDetail>(MUSIC_MUTE_EVENT, { detail: { muted: next } }));
  }

  return (
    <button
      className="globalMusicMute"
      type="button"
      aria-label={muted ? "Turn birthday music on" : "Mute birthday music"}
      aria-pressed={muted}
      title={muted ? "Turn birthday music on" : "Mute birthday music"}
      onClick={toggleMusic}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M4 9.5v5h4l5 4v-13l-5 4H4Z" />
        {!muted && <path d="M16 9a4 4 0 0 1 0 6M18.7 6.8a7 7 0 0 1 0 10.4" />}
        {muted && <path d="m16.2 9.2 5.2 5.2m0-5.2-5.2 5.2" />}
      </svg>
      <span>{muted ? "Music off" : "Mute music"}</span>
    </button>
  );
}