"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_TRACK = "/audio/still-becoming.mp3";

type NameRecording = { id: string; contributorName: string; displayOrder: number };

export function RevealSoundtrack({
  ducked,
  names,
  finaleSignal,
  onStart
}: {
  ducked: boolean;
  names: NameRecording[];
  finaleSignal: number;
  onStart: () => void;
}) {
  const songRef = useRef<HTMLAudioElement>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const chorusGain = useRef<GainNode | null>(null);
  const chorusSources = useRef<AudioBufferSourceNode[]>([]);
  const chorusRun = useRef(0);
  const previousMuted = useRef(new WeakMap<HTMLMediaElement, boolean>());
  const startedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [masterMuted, setMasterMuted] = useState(false);
  const [chorusEnabled, setChorusEnabled] = useState(true);
  const [volume, setVolume] = useState(.56);
  const [error, setError] = useState(false);
  const track = process.env.NEXT_PUBLIC_REVEAL_SOUNDTRACK_URL || DEFAULT_TRACK;

  useEffect(() => {
    const song = songRef.current;
    if (song) song.volume = masterMuted || ducked ? 0 : volume;
    if (chorusGain.current) chorusGain.current.gain.setTargetAtTime(masterMuted || ducked || !chorusEnabled ? 0 : .13, audioContext.current?.currentTime ?? 0, .04);
  }, [chorusEnabled, ducked, masterMuted, volume]);

  useEffect(() => {
    const root = document.querySelector(".revealExperience");
    if (!root) return;
    const apply = (node: ParentNode) => {
      node.querySelectorAll<HTMLMediaElement>("audio,video").forEach(element => {
        if (element === songRef.current) return;
        if (masterMuted) {
          if (!previousMuted.current.has(element)) previousMuted.current.set(element, element.muted);
          element.muted = true;
        } else {
          element.muted = previousMuted.current.get(element) ?? element.muted;
          previousMuted.current.delete(element);
        }
      });
    };
    apply(root);
    if (!masterMuted) return;
    const observer = new MutationObserver(() => apply(root));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [masterMuted]);

  useEffect(() => {
    if (finaleSignal > 0 && startedRef.current && playing && chorusEnabled) void playChorus();
  }, [finaleSignal]);

  useEffect(() => () => stopChorus(), []);

  async function ensureAudioContext() {
    if (!audioContext.current) {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContext.current = new AudioContextClass();
      chorusGain.current = audioContext.current.createGain();
      chorusGain.current.gain.value = .13;
      chorusGain.current.connect(audioContext.current.destination);
    }
    await audioContext.current.resume();
    return audioContext.current;
  }

  function orderedNames() {
    const first = names.filter(item => item.displayOrder === 1);
    const last = names.filter(item => item.displayOrder >= 9999);
    const middle = names.filter(item => item.displayOrder !== 1 && item.displayOrder < 9999);
    for (let index = middle.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [middle[index], middle[swap]] = [middle[swap], middle[index]];
    }
    return [...first, ...middle, ...last];
  }

  function stopChorus() {
    chorusRun.current += 1;
    chorusSources.current.forEach(source => { try { source.stop(); } catch {} });
    chorusSources.current = [];
  }

  async function playChorus(force = false) {
    if ((!chorusEnabled && !force) || !names.length) return;
    const context = await ensureAudioContext();
    if (!context || !chorusGain.current) return;
    stopChorus();
    const run = chorusRun.current;
    let nextStart = context.currentTime + .15;
    for (const recording of orderedNames()) {
      if (run !== chorusRun.current || !chorusEnabled) return;
      try {
        const response = await fetch(`/api/reveal/media/${recording.id}`, { cache: "force-cache" });
        if (!response.ok) continue;
        const decoded = await context.decodeAudioData(await response.arrayBuffer());
        if (run !== chorusRun.current) return;
        const source = context.createBufferSource();
        source.buffer = decoded;
        source.connect(chorusGain.current);
        const start = Math.max(nextStart, context.currentTime + .06);
        source.start(start);
        chorusSources.current.push(source);
        const overlap = .28 + Math.random() * .42;
        nextStart = start + Math.max(.7, decoded.duration - overlap);
      } catch {
        // One unusable name never interrupts the room of voices.
      }
    }
  }

  async function togglePlayback() {
    const song = songRef.current;
    if (!song) return;
    if (playing) {
      song.pause();
      stopChorus();
      setPlaying(false);
      return;
    }
    setError(false);
    try {
      const contextPromise = ensureAudioContext();
      await song.play();
      await contextPromise;
      if (!startedRef.current) {
        startedRef.current = true;
        onStart();
      }
      setPlaying(true);
      if (chorusEnabled) void playChorus();
    } catch {
      setError(true);
      setPlaying(false);
    }
  }

  function toggleChorus() {
    const next = !chorusEnabled;
    setChorusEnabled(next);
    if (!next) stopChorus();
    else if (playing) void playChorus(true);
  }

  return (
    <>
      <div className="musicInvitation">
        <span aria-hidden="true">♪</span>
        <div>
          <strong>Come into the room.</strong>
          <p>Begin the birthday song and hear the names of the people who are here for Sandi.</p>
        </div>
        <button type="button" onClick={togglePlayback}>{playing ? "Pause" : "Press play"}</button>
        {error && <small role="status">The soundtrack could not start. Tap once more, or continue in silence.</small>}
      </div>

      <audio ref={songRef} preload="auto" loop onEnded={() => setPlaying(false)}>
        <source src={track} type="audio/mpeg" />
      </audio>

      {playing && (
        <aside className="soundtrackDock" aria-label="Reveal audio controls">
          <button type="button" onClick={togglePlayback}>Pause</button>
          <label>
            <span className="srOnly">Birthday song volume</span>
            <input type="range" min="0" max="1" step=".05" value={volume} onChange={event => setVolume(Number(event.target.value))} />
          </label>
          <button type="button" onClick={toggleChorus} aria-pressed={chorusEnabled}>{chorusEnabled ? "Voices on" : "Voices off"}</button>
          <button className="masterMute" type="button" onClick={() => setMasterMuted(value => !value)} aria-pressed={masterMuted}>
            {masterMuted ? "Unmute all" : "Mute all"}
          </button>
          {ducked && <span className="soundtrackDucked" aria-live="polite">Music and chorus paused for this voice</span>}
        </aside>
      )}
    </>
  );
}
