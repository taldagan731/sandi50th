"use client";

import { useEffect, useRef, useState } from "react";

type ChapterLink = {
  number: number;
  title: string;
};

export function ChapterNavigator({ chapters, currentIndex, onSelect }: {
  chapters: ChapterLink[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const current = chapters[currentIndex];
  const progress = chapters.length ? ((currentIndex + 1) / chapters.length) * 100 : 0;

  useEffect(() => {
    if (!open) return;
    function closeFromOutside(event: PointerEvent) {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) setOpen(false);
    }
    function closeFromEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeFromOutside);
    window.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      window.removeEventListener("keydown", closeFromEscape);
    };
  }, [open]);

  useEffect(() => {
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    function handleScroll() {
      setScrolling(true);
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => setScrolling(false), 220);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, []);

  function select(index: number) {
    onSelect(index);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className={`chapterNavigator${open ? " isOpen" : ""}${scrolling ? " isScrolling" : ""}`}>
      <button
        ref={toggleRef}
        className="chapterNavigatorToggle"
        type="button"
        aria-expanded={open}
        aria-controls="chapter-navigator-panel"
        aria-label={`${open ? "Close" : "Open"} chapter navigation. Current chapter ${String(current?.number ?? 1).padStart(2, "0")}, ${current?.title ?? "Story"}`}
        onClick={() => setOpen(value => !value)}
      >
        <span>{String(current?.number ?? 1).padStart(2, "0")}</span>
      </button>

      <nav id="chapter-navigator-panel" className="chapterNavigatorPanel" aria-label="Jump to a story chapter">
        <header>
          <span>HER STORY</span>
          <strong>Chapter {currentIndex + 1} of {chapters.length}</strong>
          <span
            className="chapterNavigatorProgress"
            role="progressbar"
            aria-label="Progress through Sandi’s story"
            aria-valuemin={1}
            aria-valuemax={chapters.length}
            aria-valuenow={currentIndex + 1}
          >
            <i style={{ width: `${progress}%` }} />
          </span>
        </header>
        <div className="chapterNavigatorList">
          {chapters.map((item, index) => (
            <button
              key={item.number}
              type="button"
              aria-current={index === currentIndex ? "page" : undefined}
              aria-label={`Chapter ${String(item.number).padStart(2, "0")}: ${item.title}${index === currentIndex ? ", current chapter" : ""}`}
              onClick={() => select(index)}
            >
              <span>{String(item.number).padStart(2, "0")}</span>
              <strong>{item.title}</strong>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
