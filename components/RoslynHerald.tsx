"use client";

import Image from "next/image";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./RoslynHerald.module.css";

const PAGE_IMAGE = "/images/birth-week/roslyn-herald-page.webp";
const FULL_IMAGE = "/images/birth-week/roslyn-herald-page-full.webp";
const ALT_TEXT = "Front page of The Roslyn Herald, special morning edition dated Wednesday, August 11, 1976. The lead headline reads, 'A Girl Is Born in Roslyn; the World Will Know Her as Sandi.' A boxed announcement says, 'Sandi Has Arrived.' Supporting headlines cover Viking 2's journey to Mars, the United States Bicentennial, Hurricane Belle, New York summer, entertainment, Apple Computer, prices, weather, and Roslyn community news.";

type Point = { x: number; y: number };

export function RoslynHerald() {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef({ distance: 0, startScale: 1, lastX: 0, lastY: 0 });
  const scaleRef = useRef(1);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function resetView() {
    scaleRef.current = 1;
    setScale(1);
    setPosition({ x: 0, y: 0 });
    pointers.current.clear();
  }

  function closeViewer() {
    resetView();
    setOpen(false);
  }

  function changeZoom(next: number) {
    const clamped = Math.max(1, Math.min(5, next));
    scaleRef.current = clamped;
    setScale(clamped);
    if (clamped === 1) setPosition({ x: 0, y: 0 });
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const values = Array.from(pointers.current.values());
    if (values.length === 1) {
      gesture.current.lastX = values[0].x;
      gesture.current.lastY = values[0].y;
    } else if (values.length === 2) {
      gesture.current.distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
      gesture.current.startScale = scaleRef.current;
      gesture.current.lastX = (values[0].x + values[1].x) / 2;
      gesture.current.lastY = (values[0].y + values[1].y) / 2;
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const values = Array.from(pointers.current.values());
    if (values.length === 2) {
      const distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
      const midpoint = { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 };
      const nextScale = Math.max(1, Math.min(5, gesture.current.startScale * distance / Math.max(1, gesture.current.distance)));
      scaleRef.current = nextScale;
      setScale(nextScale);
      setPosition(current => ({
        x: current.x + midpoint.x - gesture.current.lastX,
        y: current.y + midpoint.y - gesture.current.lastY
      }));
      gesture.current.lastX = midpoint.x;
      gesture.current.lastY = midpoint.y;
    } else if (values.length === 1 && scaleRef.current > 1) {
      const point = values[0];
      setPosition(current => ({
        x: current.x + point.x - gesture.current.lastX,
        y: current.y + point.y - gesture.current.lastY
      }));
      gesture.current.lastX = point.x;
      gesture.current.lastY = point.y;
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    const remaining = Array.from(pointers.current.values());
    if (remaining.length === 1) {
      gesture.current.lastX = remaining[0].x;
      gesture.current.lastY = remaining[0].y;
    }
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    changeZoom(scaleRef.current + (event.deltaY < 0 ? .35 : -.35));
  }

  const imageStyle = {
    transform: "translate3d(" + position.x + "px," + position.y + "px,0) scale(" + scale + ")"
  } as CSSProperties;

  const viewer = open ? createPortal(
    <div className={styles.viewer} role="dialog" aria-modal="true" aria-label="Expanded Roslyn Herald front page">
      <div className={styles.toolbar}>
        <span>Pinch, scroll, or use the controls to read</span>
        <div>
          <button type="button" onClick={() => changeZoom(scaleRef.current - .5)} aria-label="Zoom out">-</button>
          <button type="button" onClick={() => changeZoom(scaleRef.current + .5)} aria-label="Zoom in">+</button>
          <button type="button" onClick={resetView}>Reset</button>
          <button type="button" onClick={closeViewer}>Close</button>
        </div>
      </div>
      <div
        className={styles.viewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={() => changeZoom(scaleRef.current === 1 ? 2.5 : 1)}
      >
        <img src={FULL_IMAGE} alt={ALT_TEXT} draggable={false} style={imageStyle} />
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <section className={styles.section} aria-labelledby="roslyn-herald-title">
      <header className={styles.introduction}>
        <span>THE WORLD SHE ARRIVED INTO</span>
        <h3 id="roslyn-herald-title">The Roslyn Herald</h3>
        <p>Sandi arrives in Roslyn as a storm clears, spacecraft circles Mars, and America celebrates its two-hundredth summer.</p>
      </header>

      <button className={styles.pageButton} type="button" onClick={() => setOpen(true)} aria-label="Open The Roslyn Herald front page full screen to read and zoom">
        <span className={styles.pageFrame}>
          <Image src={PAGE_IMAGE} width={720} height={1080} sizes="(max-width: 520px) 94vw, (max-width: 1100px) 78vw, 760px" quality={80} loading="lazy" alt={ALT_TEXT} />
        </span>
        <span className={styles.readCue}><b aria-hidden="true">+</b> Tap to read and zoom</span>
      </button>

      <div className={styles.visuallyHidden}>
        <h4>A Girl Is Born in Roslyn; the World Will Know Her as Sandi</h4>
        <p>Daughter arrives during America's Bicentennial summer. Family reports mother and child doing well.</p>
        <p>A baby girl named Sandi entered the world in Roslyn on August 11, 1976. Relatives described her as alert, strong-voiced, and smiling. Friends and family across Roslyn began stopping by with gifts, flowers, and plenty of advice.</p>
        <h4>Other front-page headlines</h4>
        <p>Viking 2 continues its journey to Mars. The nation enters its third century. Hurricane Belle moves through the Northeast. New York summer moves on.</p>
      </div>

      {viewer}
    </section>
  );
}
