"use client";

import { useEffect, useRef, useState } from "react";
import { MUSIC_MUTE_EVENT, MUSIC_MUTE_STORAGE_KEY, type MusicMuteEventDetail } from "@/lib/music-preference";

const DEFAULT_TRACK = "/audio/tavalodet-mobarak.mp3";

function savedMusicMutePreference() {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(MUSIC_MUTE_STORAGE_KEY) === "true"; }
  catch { return false; }
}

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
  const fadeFrame = useRef<number | null>(null);
  const activeSpokenMedia = useRef<HTMLMediaElement | null>(null);
  const previousMuted = useRef(new WeakMap<HTMLMediaElement, boolean>());
  const startedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [masterMuted, setMasterMuted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(savedMusicMutePreference);
  const [chorusEnabled, setChorusEnabled] = useState(true);
  const [volume, setVolume] = useState(.56);
  const [duckVolume, setDuckVolume] = useState(.12);
  const [mediaDucked, setMediaDucked] = useState(false);
  const [error, setError] = useState(false);
  const track = process.env.NEXT_PUBLIC_REVEAL_SOUNDTRACK_URL || DEFAULT_TRACK;

  const shouldDuck = ducked || mediaDucked;

  useEffect(() => {
    const readSaved = () => {
      try { setMusicMuted(window.localStorage.getItem(MUSIC_MUTE_STORAGE_KEY) === "true"); }
      catch { setMusicMuted(false); }
    };
    const handleMute = (event: Event) => setMusicMuted((event as CustomEvent<MusicMuteEventDetail>).detail.muted);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === MUSIC_MUTE_STORAGE_KEY) setMusicMuted(event.newValue === "true");
    };
    readSaved();
    window.addEventListener(MUSIC_MUTE_EVENT, handleMute);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(MUSIC_MUTE_EVENT, handleMute);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const song = songRef.current;
    if (song) {
      const target = masterMuted || musicMuted ? 0 : shouldDuck ? Math.min(volume, duckVolume) : volume;
      const duration = shouldDuck || masterMuted || musicMuted ? 300 : 1400;
      if (fadeFrame.current !== null) cancelAnimationFrame(fadeFrame.current);
      const start = song.volume;
      const startedAt = performance.now();
      const fade = (now: number) => {
        const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
        song.volume = Math.max(0, Math.min(1, start + (target - start) * progress));
        fadeFrame.current = progress < 1 ? requestAnimationFrame(fade) : null;
      };
      fadeFrame.current = requestAnimationFrame(fade);
    }
    if (chorusGain.current) chorusGain.current.gain.setTargetAtTime(masterMuted || musicMuted || shouldDuck || !chorusEnabled ? 0 : .13, audioContext.current?.currentTime ?? 0, .04);
    return () => {
      if (fadeFrame.current !== null) cancelAnimationFrame(fadeFrame.current);
    };
  }, [chorusEnabled, duckVolume, masterMuted, musicMuted, shouldDuck, volume]);

  useEffect(() => {
    const root = document.querySelector(".revealExperience");
    if (!root) return;

    const release = (element: HTMLMediaElement) => {
      if (activeSpokenMedia.current !== element) return;
      activeSpokenMedia.current = null;
      setMediaDucked(false);
    };
    const handlePlay = (event: Event) => {
      const element = event.target;
      if (!(element instanceof HTMLMediaElement) || element === songRef.current || element.muted) return;
      const previous = activeSpokenMedia.current;
      if (previous && previous !== element && !previous.paused) previous.pause();
      activeSpokenMedia.current = element;
      setMediaDucked(true);
    };
    const handleEnded = (event: Event) => {
      if (event.target instanceof HTMLMediaElement) release(event.target);
    };
    const handleVolume = (event: Event) => {
      const element = event.target;
      if (!(element instanceof HTMLMediaElement) || element === songRef.current) return;
      if (!element.muted && !element.paused) handlePlay(event);
    };
    const observer = new MutationObserver(() => {
      const active = activeSpokenMedia.current;
      if (active && !active.isConnected) release(active);
    });

    root.addEventListener("play", handlePlay, true);
    root.addEventListener("ended", handleEnded, true);
    root.addEventListener("emptied", handleEnded, true);
    root.addEventListener("volumechange", handleVolume, true);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      root.removeEventListener("play", handlePlay, true);
      root.removeEventListener("ended", handleEnded, true);
      root.removeEventListener("emptied", handleEnded, true);
      root.removeEventListener("volumechange", handleVolume, true);
      observer.disconnect();
    };
  }, []);

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

  useEffect(() => {
    let disposed = false;
    const detach = () => {
      document.removeEventListener("pointerdown", beginFromGesture, true);
      document.removeEventListener("touchstart", beginFromGesture, true);
      document.removeEventListener("keydown", beginFromGesture, true);
    };
    const attempt = async () => {
      if (disposed || startedRef.current) return;
      if (await startPlayback(false)) detach();
    };
    function beginFromGesture() { void attempt(); }
    document.addEventListener("pointerdown", beginFromGesture, true);
    document.addEventListener("touchstart", beginFromGesture, true);
    document.addEventListener("keydown", beginFromGesture, true);
    void attempt();
    return () => { disposed = true; detach(); };
  }, []);

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

  async function startPlayback(reportFailure = false) {
    const song = songRef.current;
    if (!song) return false;
    setError(false);
    const contextPromise = ensureAudioContext().catch(() => null);
    try {
      await song.play();
      if (!startedRef.current) {
        startedRef.current = true;
        onStart();
      }
      setPlaying(true);
      void contextPromise.then(context => {
        if (context && chorusEnabled) void playChorus();
      });
      return true;
    } catch {
      if (reportFailure) setError(true);
      setPlaying(false);
      return false;
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
    await startPlayback(true);
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
        {!playing && <small role="status">Music begins automatically. If your browser pauses sound, your first tap anywhere will start it.</small>}
        {error && <small role="status">Sound is still paused by this browser. Tap anywhere in the reveal to begin.</small>}
      </div>

      <audio ref={songRef} preload="auto" loop onEnded={() => setPlaying(false)}>
        <source src={track} type="audio/mpeg" />
      </audio>

      {playing && (
        <aside className="soundtrackDock" aria-label="Reveal audio controls">
          <button type="button" onClick={togglePlayback}>Pause</button>
          <label>
            <span>Music {Math.round(volume * 100)}%</span>
            <input aria-label="Birthday song volume" type="range" min="0" max="1" step=".05" value={volume} onChange={event => setVolume(Number(event.target.value))} />
          </label>
          <label title="Music level while someone is speaking">
            <span>Under voices {Math.round(duckVolume * 100)}%</span>
            <input aria-label="Music level under voices" type="range" min=".03" max=".18" step=".01" value={duckVolume} onChange={event => setDuckVolume(Number(event.target.value))} />
          </label>
          <button type="button" onClick={toggleChorus} aria-pressed={chorusEnabled}>{chorusEnabled ? "Voices on" : "Voices off"}</button>
          <button className="masterMute" type="button" onClick={() => setMasterMuted(value => !value)} aria-pressed={masterMuted}>
            {masterMuted ? "Unmute all" : "Mute all"}
          </button>
          {shouldDuck && <span className="soundtrackDucked" aria-live="polite">Music lowered; name chorus paused for this voice</span>}
        </aside>
      )}
    </>
  );
}
