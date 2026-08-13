"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_TRACK = "/audio/tavalodet-mobarak.mp3";
const DEFAULT_DUCK_RATIO = .05;
const DUCK_STORAGE_KEY = "sandi-reveal-duck-ratio";

type NameRecording = { id: string; contributorName: string; displayOrder: number };

export function RevealSoundtrack({
  ducked,
  names,
  finaleSignal,
  onStart,
  ownerRehearsal = false
}: {
  ducked: boolean;
  names: NameRecording[];
  finaleSignal: number;
  onStart: () => void;
  ownerRehearsal?: boolean;
}) {
  const songRef = useRef<HTMLAudioElement>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const songSource = useRef<MediaElementAudioSourceNode | null>(null);
  const songGain = useRef<GainNode | null>(null);
  const chorusGain = useRef<GainNode | null>(null);
  const chorusSources = useRef<AudioBufferSourceNode[]>([]);
  const chorusRun = useRef(0);
  const focusedMedia = useRef<HTMLMediaElement | null>(null);
  const releaseTimer = useRef<number | null>(null);
  const previousMuted = useRef(new WeakMap<HTMLMediaElement, boolean>());
  const startedRef = useRef(false);
  const speakingRef = useRef(false);
  const pendingFinaleChorus = useRef(false);
  const [mediaFocusActive, setMediaFocusActive] = useState(false);
  const [externalAudioActive, setExternalAudioActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [masterMuted, setMasterMuted] = useState(false);
  const [chorusEnabled, setChorusEnabled] = useState(true);
  const [volume, setVolume] = useState(.56);
  const [duckRatio, setDuckRatio] = useState(DEFAULT_DUCK_RATIO);
  const [error, setError] = useState(false);
  const track = process.env.NEXT_PUBLIC_REVEAL_SOUNDTRACK_URL || DEFAULT_TRACK;
  const speaking = ducked || mediaFocusActive;
  speakingRef.current = speaking;

  useEffect(() => {
    const onExternalAudio = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      setExternalAudioActive(Boolean(detail?.active));
    };
    window.addEventListener("sandi:external-audio", onExternalAudio);
    return () => window.removeEventListener("sandi:external-audio", onExternalAudio);
  }, []);

  useEffect(() => {
    const syncGlobalMute = (event?: Event) => {
      const detail = (event as CustomEvent<{ muted?: boolean }> | undefined)?.detail;
      const next = detail?.muted ?? window.localStorage.getItem("sandi-global-muted") === "true";
      setMasterMuted(next);
    };
    syncGlobalMute();
    window.addEventListener("sandi:global-mute", syncGlobalMute);
    return () => window.removeEventListener("sandi:global-mute", syncGlobalMute);
  }, []);
  useEffect(() => {
    if (!ownerRehearsal) return;
    const timer = window.setTimeout(() => {
      const stored = Number(window.localStorage.getItem(DUCK_STORAGE_KEY));
      if (Number.isFinite(stored) && stored >= .03 && stored <= .2) setDuckRatio(stored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ownerRehearsal]);

  function ramp(parameter: AudioParam, target: number, seconds: number) {
    const context = audioContext.current;
    if (!context) return;
    const now = context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(parameter.value, now);
    parameter.linearRampToValueAtTime(target, now + seconds);
  }

  useEffect(() => {
    const soundtrackSuppressed = masterMuted || externalAudioActive;
    const activeDuckRatio = mediaFocusActive ? .05 : duckRatio;
    const target = soundtrackSuppressed ? 0 : speaking ? volume * activeDuckRatio : volume;
    const duration = soundtrackSuppressed ? .2 : speaking ? .3 : 1.4;
    if (songGain.current) ramp(songGain.current.gain, target, duration);
    else if (songRef.current) songRef.current.volume = target;

    const chorusTarget = soundtrackSuppressed || speaking || !chorusEnabled ? 0 : .13;
    if (chorusGain.current) ramp(chorusGain.current.gain, chorusTarget, speaking ? .03 : .35);
    if (speaking || externalAudioActive) stopChorus();
    else if (pendingFinaleChorus.current && playing && chorusEnabled) {
      pendingFinaleChorus.current = false;
      void playChorus();
    }
  }, [chorusEnabled, duckRatio, externalAudioActive, masterMuted, mediaFocusActive, ducked, playing, volume]);

  useEffect(() => {
    const root = document.querySelector(".revealExperience");
    if (!root) return;
    const wired = new WeakSet<HTMLMediaElement>();

    const clearRelease = () => {
      if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
    };
    const release = (element: HTMLMediaElement, delay = 0) => {
      if (focusedMedia.current !== element) return;
      clearRelease();
      releaseTimer.current = window.setTimeout(() => {
        if (focusedMedia.current !== element) return;
        focusedMedia.current = null;
        setMediaFocusActive(false);
        releaseTimer.current = null;
      }, delay);
    };
    const focus = (element: HTMLMediaElement) => {
      if (element === songRef.current || element.muted || element.volume === 0) return;
      clearRelease();
      const previous = focusedMedia.current;
      if (previous && previous !== element && !previous.paused) previous.pause();
      focusedMedia.current = element;
      setMediaFocusActive(true);
    };
    const wire = (element: HTMLMediaElement) => {
      if (wired.has(element) || element === songRef.current) return;
      wired.add(element);
      element.addEventListener("webkitendfullscreen", () => {
        if (element.paused) release(element);
      });
    };
    const scan = () => {
      root.querySelectorAll<HTMLMediaElement>("audio,video").forEach(wire);
      const current = focusedMedia.current;
      if (current && !current.isConnected) release(current);
    };
    const requestVideoSound = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const video = target.closest("video[controls]") as HTMLVideoElement | null;
      if (!video) return;
      window.localStorage.setItem("sandi-global-muted", "false");
      window.dispatchEvent(new CustomEvent("sandi:global-mute", { detail: { muted: false } }));
      video.muted = false;
      if (video.volume === 0) video.volume = 1;
    };
    const onPlay = (event: Event) => {
      if (event.target instanceof HTMLMediaElement) focus(event.target);
    };
    const onVolumeChange = (event: Event) => {
      if (!(event.target instanceof HTMLMediaElement) || event.target === songRef.current) return;
      if (!event.target.paused && !event.target.muted && event.target.volume > 0) focus(event.target);
      else if ((event.target.muted || event.target.volume === 0) && focusedMedia.current === event.target) release(event.target);
    };
    const onEnded = (event: Event) => {
      if (event.target instanceof HTMLMediaElement) release(event.target, 450);
    };
    const onInterrupted = (event: Event) => {
      if (event.target instanceof HTMLMediaElement) release(event.target);
    };
    const onFullscreenChange = () => {
      const current = focusedMedia.current;
      if (!document.fullscreenElement && current?.paused) release(current);
    };

    scan();
    root.addEventListener("pointerdown", requestVideoSound, true);
    root.addEventListener("keydown", requestVideoSound, true);
    root.addEventListener("play", onPlay, true);
    root.addEventListener("volumechange", onVolumeChange, true);
    root.addEventListener("ended", onEnded, true);
    root.addEventListener("abort", onInterrupted, true);
    root.addEventListener("emptied", onInterrupted, true);
    root.addEventListener("error", onInterrupted, true);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    const observer = new MutationObserver(scan);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      clearRelease();
      observer.disconnect();
      root.removeEventListener("pointerdown", requestVideoSound, true);
      root.removeEventListener("keydown", requestVideoSound, true);
      root.removeEventListener("play", onPlay, true);
      root.removeEventListener("volumechange", onVolumeChange, true);
      root.removeEventListener("ended", onEnded, true);
      root.removeEventListener("abort", onInterrupted, true);
      root.removeEventListener("emptied", onInterrupted, true);
      root.removeEventListener("error", onInterrupted, true);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
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
    if (finaleSignal <= 0 || !startedRef.current || !playing || !chorusEnabled) return;
    if (speakingRef.current) pendingFinaleChorus.current = true;
    else void playChorus();
  }, [finaleSignal]);

  useEffect(() => () => {
    stopChorus();
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
    void audioContext.current?.close();
  }, []);

  async function ensureAudioContext() {
    if (!audioContext.current) {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      const context = new AudioContextClass();
      audioContext.current = context;
      songGain.current = context.createGain();
      chorusGain.current = context.createGain();
      songGain.current.gain.value = masterMuted || externalAudioActive ? 0 : speakingRef.current ? volume * duckRatio : volume;
      chorusGain.current.gain.value = masterMuted || externalAudioActive || speakingRef.current || !chorusEnabled ? 0 : .13;
      songGain.current.connect(context.destination);
      chorusGain.current.connect(context.destination);
      if (songRef.current) {
        songRef.current.volume = 1;
        songSource.current = context.createMediaElementSource(songRef.current);
        songSource.current.connect(songGain.current);
      }
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
    if (speakingRef.current || (!chorusEnabled && !force) || !names.length) return;
    const context = await ensureAudioContext();
    if (!context || !chorusGain.current || speakingRef.current) return;
    stopChorus();
    const run = chorusRun.current;
    let nextStart = context.currentTime + .15;
    for (const recording of orderedNames()) {
      if (run !== chorusRun.current || !chorusEnabled || speakingRef.current) return;
      try {
        const response = await fetch(`/api/reveal/media/${recording.id}`, { cache: "force-cache" });
        if (!response.ok) continue;
        const decoded = await context.decodeAudioData(await response.arrayBuffer());
        if (run !== chorusRun.current || speakingRef.current) return;
        const source = context.createBufferSource();
        source.buffer = decoded;
        source.connect(chorusGain.current);
        const start = Math.max(nextStart, context.currentTime + .06);
        source.start(start);
        chorusSources.current.push(source);
        const overlap = .28 + Math.random() * .42;
        nextStart = start + Math.max(.7, decoded.duration - overlap);
      } catch {}
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
    window.localStorage.setItem("sandi-global-muted", "false");
    window.dispatchEvent(new CustomEvent("sandi:global-mute", { detail: { muted: false } }));
    setMasterMuted(false);
    song.muted = false;
    try {
      const contextReady = ensureAudioContext();
      const playback = song.play();
      await contextReady;
      if (songGain.current) songGain.current.gain.value = speakingRef.current ? volume * duckRatio : volume;
      await playback;
      if (!startedRef.current) { startedRef.current = true; onStart(); }
      setPlaying(true);
      if (chorusEnabled && !speakingRef.current) void playChorus();
    } catch {
      setError(true);
      setPlaying(false);
    }
  }

  function toggleChorus() {
    const next = !chorusEnabled;
    setChorusEnabled(next);
    if (!next) stopChorus();
    else if (playing && !speakingRef.current) void playChorus(true);
  }

  function changeDuckRatio(next: number) {
    setDuckRatio(next);
    window.localStorage.setItem(DUCK_STORAGE_KEY, String(next));
  }

  return <>
    <div className="musicInvitation">
      <span aria-hidden="true">♪</span><div><strong>Come into the room.</strong><p>Begin the birthday song and hear the names of the people who are here for Sandi.</p></div>
      <button type="button" onClick={togglePlayback}>{playing ? "Pause" : "Press play"}</button>
      {error && <small role="status">The soundtrack could not start. Tap once more, or continue in silence.</small>}
    </div>
    <audio ref={songRef} preload="metadata" loop onEnded={() => setPlaying(false)}><source src={track} type="audio/mpeg" /></audio>
    {playing && <aside className="soundtrackDock" aria-label="Reveal audio controls">
      <button type="button" onClick={togglePlayback}>Pause</button>
      <label><span className="srOnly">Birthday song volume</span><input type="range" min="0" max="1" step=".05" value={volume} onChange={event => setVolume(Number(event.target.value))} /></label>
      <button type="button" onClick={toggleChorus} aria-pressed={chorusEnabled}>{chorusEnabled ? "Voices on" : "Voices off"}</button>
      <button className="masterMute" type="button" onClick={() => setMasterMuted(value => !value)} aria-pressed={masterMuted}>{masterMuted ? "Unmute all" : "Mute all"}</button>
      {ownerRehearsal && <label className="duckingTuner"><span>Voice music bed <strong>{Math.round(duckRatio * 100)}%</strong></span><input aria-label="Music level under spoken recordings" type="range" min=".03" max=".15" step=".01" value={duckRatio} onChange={event => changeDuckRatio(Number(event.target.value))} /></label>}
      {speaking && <span className="soundtrackDucked" aria-live="polite">Music at {Math.round(duckRatio * 100)}% · other voices muted</span>}
    </aside>}
  </>;
}