"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_TRACK = "/audio/still-becoming.mp3";

export function RevealSoundtrack({ ducked }: { ducked: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(.55);
  const [error, setError] = useState(false);
  const track = process.env.NEXT_PUBLIC_REVEAL_SOUNDTRACK_URL || DEFAULT_TRACK;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : ducked ? Math.min(volume, .12) : volume;
  }, [ducked, muted, volume]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    setError(false);
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setError(true);
      setPlaying(false);
    }
  }

  return (
    <>
      <div className="musicInvitation">
        <span aria-hidden="true">♪</span>
        <div>
          <strong>Let the story have a soundtrack.</strong>
          <p>Start the music, then move through the chapters at your own pace.</p>
        </div>
        <button type="button" onClick={toggle}>{playing ? "Pause music" : "Press play"}</button>
        {error && <small role="status">The soundtrack file has not been added to this preview yet.</small>}
      </div>

      <audio
        ref={audioRef}
        preload="none"
        loop
        onEnded={() => setPlaying(false)}
        onError={() => { if (playing) setError(true); }}
      >
        <source src={track} type="audio/mpeg" />
      </audio>

      {playing && (
        <aside className="soundtrackDock" aria-label="Soundtrack controls">
          <button type="button" onClick={toggle} aria-label="Pause soundtrack">Pause</button>
          <label>
            <span className="srOnly">Soundtrack volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step=".05"
              value={volume}
              onChange={event => setVolume(Number(event.target.value))}
            />
          </label>
          <button type="button" onClick={() => setMuted(value => !value)} aria-pressed={muted}>
            {muted ? "Unmute" : "Mute"}
          </button>
          {ducked && <span className="soundtrackDucked" aria-live="polite">Music lowered for this voice</span>}
        </aside>
      )}
    </>
  );
}
