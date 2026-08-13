"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type SpotifyPlaybackEvent = { data?: { isPaused?: boolean; position?: number; duration?: number } };
type SpotifyController = {
  loadUri: (uri: string) => void;
  play: () => void;
  pause: () => void;
  addListener: (event: "playback_update", callback: (event: SpotifyPlaybackEvent) => void) => void;
  destroy?: () => void;
};
type SpotifyApi = {
  createController: (
    element: HTMLElement,
    options: { uri: string; width: string; height: number },
    callback: (controller: SpotifyController) => void
  ) => void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyApi) => void;
    __sandiSpotifyApi?: SpotifyApi;
  }
}

type JukeboxTrack = { era: string; title: string; artist: string; year: string; id: string; note?: string };
type CassettePhase = "presenting" | "opening" | "ejecting" | "inserting" | "closing" | "loaded";

const tracks: JukeboxTrack[] = [
  { era: "1976 · Arrival", title: "Don’t Go Breaking My Heart", artist: "Elton John & Kiki Dee", year: "1976", id: "7HW5WIw7ZgZORCzUxv5gW5" },
  { era: "1976 · Arrival", title: "Isn’t She Lovely", artist: "Stevie Wonder", year: "1976", id: "54ZrZ08GGZdyMn1L8zqvTx" },
  { era: "1976 · Arrival", title: "You Should Be Dancing", artist: "Bee Gees", year: "1976", id: "4avxDoDfke26ZPwL3M4L2H" },
  { era: "Growing Up", title: "I Wanna Dance with Somebody", artist: "Whitney Houston", year: "1987", id: "3EOwPgKZEhD6Mrb15G6txx" },
  { era: "Finding Her Voice", title: "Like a Prayer", artist: "Madonna", year: "1989", id: "14p4jbULrRxZvnSt4NDSEs" },
  { era: "Boston · England · College", title: "Truckin’", artist: "Grateful Dead", year: "A college-years favorite", id: "1FisZPCenF50BpcizVfb5L", note: "For the Deadhead years" },
  { era: "Boston · England · College", title: "Touch of Grey", artist: "Grateful Dead", year: "A college-years favorite", id: "7vLgjhf9wK6u6s97muIk4M", note: "For the Deadhead years" },
  { era: "Boston · England · College", title: "Wonderwall", artist: "Oasis", year: "1995", id: "5wj4E6IsrVtn8IBJQOd0Cl" },
  { era: "Building Something Bigger", title: "Crazy in Love", artist: "Beyoncé feat. JAY-Z", year: "2003", id: "5IVuqXILoxVWvWEPm82Jxr" },
  { era: "Building Something Bigger", title: "Viva La Vida", artist: "Coldplay", year: "2008", id: "6WrUT7FOAlDscRWU7ndmyd" },
  { era: "The Family She Chose", title: "Happy", artist: "Pharrell Williams", year: "2013", id: "081F0W6eDkA09EzZu67Yqu" },
  { era: "Still Becoming", title: "Flowers", artist: "Miley Cyrus", year: "2023", id: "7DSAEUvxU8FajXtRloy8M0" }
];

function announceExternalAudio(active: boolean) {
  window.dispatchEvent(new CustomEvent("sandi:external-audio", { detail: { active } }));
}

export function TimelineJukebox({ forceMotion = false }: { forceMotion?: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyController | null>(null);
  const activeIndexRef = useRef(0);
  const advancingRef = useRef(false);
  const pendingPlayRef = useRef(false);
  const mechanismTimersRef = useRef<number[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [switching, setSwitching] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [spotifyActivated, setSpotifyActivated] = useState(false);
  const [mechanismPhase, setMechanismPhase] = useState<CassettePhase>("presenting");
  const [pressedControl, setPressedControl] = useState<"play" | "stop" | "eject" | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const current = tracks[activeIndex];
  activeIndexRef.current = activeIndex;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const shouldReduce = !forceMotion && preference.matches;
      setReducedMotion(shouldReduce);
      if (shouldReduce) setMechanismPhase("loaded");
    };
    update();
    preference.addEventListener?.("change", update);
    return () => preference.removeEventListener?.("change", update);
  }, [forceMotion]);

  useEffect(() => () => { mechanismTimersRef.current.forEach(timer => window.clearTimeout(timer)); }, []);

  useEffect(() => {
    const stopForGlobalMute = (event?: Event) => {
      const detail = (event as CustomEvent<{ muted?: boolean }> | undefined)?.detail;
      const muted = detail?.muted ?? window.localStorage.getItem("sandi-global-muted") === "true";
      if (!muted) return;
      pendingPlayRef.current = false;
      controllerRef.current?.pause();
      setPlaying(false);
      announceExternalAudio(false);
    };
    stopForGlobalMute();
    window.addEventListener("sandi:global-mute", stopForGlobalMute);
    return () => window.removeEventListener("sandi:global-mute", stopForGlobalMute);
  }, []);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || spotifyActivated) return;

    const prepareSpotify = () => setSpotifyActivated(true);
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) prepareSpotify();
        }, { rootMargin: "1600px 0px" })
      : null;

    observer?.observe(section);
    section.addEventListener("pointerenter", prepareSpotify, { once: true });
    section.addEventListener("focusin", prepareSpotify, { once: true });

    return () => {
      observer?.disconnect();
      section.removeEventListener("pointerenter", prepareSpotify);
      section.removeEventListener("focusin", prepareSpotify);
    };
  }, [spotifyActivated]);
  const grouped = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visible = normalized
      ? tracks.filter(track => `${track.era} ${track.title} ${track.artist} ${track.year}`.toLowerCase().includes(normalized))
      : tracks;
    return visible.reduce<Record<string, JukeboxTrack[]>>((result, track) => {
      (result[track.era] ||= []).push(track);
      return result;
    }, {});
  }, [query]);

  useEffect(() => {
    if (!spotifyActivated) return;
    let disposed = false;
    const initialize = (api: SpotifyApi) => {
      if (disposed || !mountRef.current || controllerRef.current) return;
      api.createController(mountRef.current, { uri: `spotify:track:${tracks[activeIndexRef.current].id}`, width: "100%", height: 152 }, controller => {
        if (disposed) { controller.destroy?.(); return; }
        controllerRef.current = controller;
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          controller.play();
          window.setTimeout(() => controller.play(), 180);
        }
        controller.addListener("playback_update", event => {
          const paused = event.data?.isPaused ?? true;
          const position = event.data?.position ?? 0;
          const duration = event.data?.duration ?? 0;
          announceExternalAudio(!paused);
          setPlaying(!paused);
          const reachedEnd = paused && duration > 0 && duration - position < 1200;
          if (reachedEnd && !advancingRef.current) {
            advancingRef.current = true;
            const next = (activeIndexRef.current + 1) % tracks.length;
            chooseTrack(next, true);
            window.setTimeout(() => { advancingRef.current = false; }, 1200);
          }
        });
      });
    };

    window.onSpotifyIframeApiReady = api => {
      window.__sandiSpotifyApi = api;
      initialize(api);
    };
    if (window.__sandiSpotifyApi) initialize(window.__sandiSpotifyApi);
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://open.spotify.com/embed/iframe-api/v1"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      document.body.appendChild(script);
    }
    return () => {
      disposed = true;
      announceExternalAudio(false);
      controllerRef.current?.destroy?.();
      controllerRef.current = null;
    };
  }, [spotifyActivated]);

  function mechanicalClick(stronger = false) {
    const globallyMuted = window.localStorage.getItem("sandi-global-muted") === "true";
    const spokenMediaPlaying = [...document.querySelectorAll<HTMLMediaElement>("audio, video")].some(media => !media.paused && !media.muted && !media.closest(".timelineJukebox"));
    if (reducedMotion || globallyMuted || spokenMediaPlaying) return;
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(stronger ? 118 : 172, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(54, context.currentTime + .075);
      gain.gain.setValueAtTime(stronger ? .1 : .065, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .09);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .095);
      window.setTimeout(() => void context.close(), 180);
    } catch { /* Mechanical sound is decorative; controls still work silently. */ }
  }

  function clearMechanismTimers() {
    mechanismTimersRef.current.forEach(timer => window.clearTimeout(timer));
    mechanismTimersRef.current = [];
  }

  function scheduleMechanism(callback: () => void, delay: number) {
    const timer = window.setTimeout(callback, delay);
    mechanismTimersRef.current.push(timer);
  }

  function pressControl(control: "play" | "stop" | "eject") {
    setPressedControl(control);
    window.setTimeout(() => setPressedControl(current => current === control ? null : current), 320);
  }

  function requestSpotifyPlay() {
    if (!controllerRef.current) {
      pendingPlayRef.current = true;
      setSpotifyActivated(true);
      return;
    }
    controllerRef.current.play();
    window.setTimeout(() => controllerRef.current?.play(), 160);
  }

  function insertCassette(playAfter = false) {
    clearMechanismTimers();
    setSwitching(true);
    if (reducedMotion) {
      setMechanismPhase("loaded");
      setSwitching(false);
      if (playAfter) requestSpotifyPlay();
      return;
    }
    setMechanismPhase("opening");
    scheduleMechanism(() => setMechanismPhase("inserting"), 260);
    scheduleMechanism(() => { mechanicalClick(); setMechanismPhase("closing"); }, 980);
    scheduleMechanism(() => {
      setMechanismPhase("loaded");
      setSwitching(false);
      if (playAfter) requestSpotifyPlay();
    }, 1280);
  }

  function playCurrent() {
    window.localStorage.setItem("sandi-global-muted", "false");
    window.dispatchEvent(new CustomEvent("sandi:global-mute", { detail: { muted: false } }));
    pressControl("play");
    mechanicalClick();
    requestSpotifyPlay();
    if (mechanismPhase !== "loaded") insertCassette(false);
  }

  function stopCurrent() {
    pressControl("stop");
    pendingPlayRef.current = false;
    mechanicalClick(true);
    controllerRef.current?.pause();
    setPlaying(false);
    announceExternalAudio(false);
  }

  function swapCassette(index: number, playAfter = false) {
    if (switching) return;
    pressControl("eject");
    clearMechanismTimers();
    pendingPlayRef.current = false;
    controllerRef.current?.pause();
    setPlaying(false);
    announceExternalAudio(false);
    mechanicalClick(true);
    if (reducedMotion) {
      setActiveIndex(index);
      activeIndexRef.current = index;
      controllerRef.current?.loadUri(`spotify:track:${tracks[index].id}`);
      setMechanismPhase("loaded");
      if (playAfter) requestSpotifyPlay();
      return;
    }
    setSwitching(true);
    setMechanismPhase("opening");
    scheduleMechanism(() => setMechanismPhase("ejecting"), 260);
    scheduleMechanism(() => {
      setActiveIndex(index);
      activeIndexRef.current = index;
      controllerRef.current?.loadUri(`spotify:track:${tracks[index].id}`);
      setMechanismPhase("presenting");
    }, 780);
    scheduleMechanism(() => setMechanismPhase("inserting"), 1580);
    scheduleMechanism(() => { mechanicalClick(); setMechanismPhase("closing"); }, 2260);
    scheduleMechanism(() => {
      setMechanismPhase("loaded");
      setSwitching(false);
      if (playAfter) requestSpotifyPlay();
    }, 2580);
  }

  function ejectCassette() {
    swapCassette((activeIndexRef.current + 1) % tracks.length, false);
  }

  function chooseTrack(index: number, play = false) {
    swapCassette(index, play);
  }

  function choose(track: JukeboxTrack) {
    const index = tracks.findIndex(item => item.id === track.id);
    if (index >= 0) chooseTrack(index, true);
  }

  function openSpotifySearch() {
    const term = query.trim() || `${current.title} ${current.artist}`;
    window.open(`https://open.spotify.com/search/${encodeURIComponent(term)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section ref={sectionRef} className={`timelineJukebox${forceMotion ? " forceWalkmanMotion" : ""}`} aria-labelledby="timeline-jukebox-title">
      <header>
        <span>THE SOUND OF HER LIFE</span>
        <h3 id="timeline-jukebox-title">SANDI personal stereo</h3>
        <p>Choose a cassette from any era. After playback begins, the player advances through the timeline; the birthday soundtrack steps aside while a selection is playing.</p>
      </header>

      <div className="cassetteDeck">
        <div className="deckFaceplate">
          <div className={`walkmanMatchedPhotos phase-${mechanismPhase}`} aria-hidden="true">
            <Image className="walkmanMatchedPhoto walkmanMatchedPhotoClosed" src="/images/birth-week/walkman-closed-matched.webp" alt="" fill sizes="(max-width: 540px) 94vw, 680px" />
            <Image className="walkmanMatchedPhoto walkmanMatchedPhotoOpen" src="/images/birth-week/walkman-open-matched.webp" alt="" fill sizes="(max-width: 540px) 94vw, 680px" />
          </div>
          <div className="deckHeader" aria-hidden="true"><strong className="deckBrand">SANDI</strong><span>STEREO</span><i>TPS-50</i></div>
          <div className="walkmanTop" aria-hidden="true"><span>PHONES 1</span><b /><span>PHONES 2</span><b /><span>VOLUME</span><i /></div><div className="hotLineControl" aria-hidden="true"><em />HOT LINE</div>
          <div className="deckMeters" aria-hidden="true">
            <div><span>L</span><i /><b /></div><div><span>R</span><i /><b /></div>
          </div>
          <div className={`cassetteBay cassetteMechanism phase-${mechanismPhase}${playing ? " is-playing" : ""}`} data-phase={mechanismPhase}>
            <div className="cassetteStage">
              <div className="cssCassette" role="img" aria-label={`Cassette labeled ${current.title}, ${current.artist}, ${current.year}`}>
                <div className="cassetteLabel"><small>SANDI&apos;S LIFE &middot; SIDE A &middot; {current.year}</small><strong>{current.title}</strong><span>{current.artist}</span></div>
                <div className="cassetteReels" aria-hidden="true"><i className="cassetteReel"><b /></i><span /><i className="cassetteReel"><b /></i></div>
                <div className="cassetteTapeWindow" aria-hidden="true"><i /><b /><i /></div>
                <div className="cassetteScrews" aria-hidden="true"><i /><i /><i /><i /></div>
              </div>
            </div>
            <div className="cassetteDoor" aria-hidden="true"><div className="cassetteDoorGlass"><span>SANDI</span><i /></div></div>
          </div>
          <div className="deckTransport" role="group" aria-label="Cassette player controls">
            <button type="button" data-pressed={pressedControl === "play"} onClick={playCurrent} aria-pressed={playing}>PLAY</button>
            <button type="button" data-pressed={pressedControl === "stop"} onClick={stopCurrent}>STOP</button>
            <button type="button" data-pressed={pressedControl === "eject"} onClick={ejectCassette} disabled={switching}>EJECT</button>
          </div>
          <div className="tapeNowPlaying"><span>{mechanismPhase === "loaded" ? "NOW LOADED" : "READY TO LOAD"}</span><strong>{current.title}</strong><p>{current.artist} &middot; {current.year}</p>{current.note && <small>{current.note}</small>}</div>
        </div>
        <div className="spotifyMount" ref={mountRef} aria-label="Spotify music player" />
        <p className="spotifyNote">Spotify may require a free or paid Spotify account for full-length playback. No copyrighted audio is hosted by this site.</p>
        <p className="hardwareCredits">Walkman photograph: <a href="https://commons.wikimedia.org/wiki/File:Original_Sony_Walkman_TPS-L2.JPG" target="_blank" rel="noreferrer">Binarysequence / Wikimedia Commons</a>, CC BY-SA 4.0. Cassette mechanism and SANDI presentation built for this story.</p>
      </div>

      <div className="jukeboxSearch">
        <label htmlFor="jukebox-search">Find a song, artist, year, or chapter</label>
        <div><input id="jukebox-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try “Grateful Dead” or “1976”" /><button type="button" onClick={openSpotifySearch}>Search Spotify</button></div>
      </div>

      <details className="tapeLibrary">
        <summary>Browse the tape library <span>{tracks.length} cassettes</span></summary>
        <div className="jukeboxSelections">
        {Object.entries(grouped).map(([era, eraTracks]) => (
          <section key={era}>
            <h4>{era}</h4>
            {eraTracks.map(track => (
              <button type="button" key={track.id} aria-pressed={current.id === track.id} onClick={() => choose(track)}>
                <span>{track.year}</span><strong>{track.title}</strong><small>{track.artist}</small>
              </button>
            ))}
          </section>
        ))}
        {Object.keys(grouped).length === 0 && <p className="jukeboxNoResults">No curated match. Use “Search Spotify” to look for it there.</p>}
        </div>
      </details>
    </section>
  );
}

