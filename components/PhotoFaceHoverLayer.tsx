"use client";

import { useEffect, useRef, useState } from "react";

type Tag = { id: string; name: string; x: number; y: number; width: number; height: number };
type Positioned = Tag & { left: number; top: number; boxWidth: number; boxHeight: number };

function positionTags(image: HTMLImageElement, tags: Tag[]): Positioned[] {
  const rect = image.getBoundingClientRect();
  const naturalWidth = image.naturalWidth || rect.width;
  const naturalHeight = image.naturalHeight || rect.height;
  const fit = getComputedStyle(image).objectFit;
  const scale = fit === "cover" ? Math.max(rect.width / naturalWidth, rect.height / naturalHeight)
    : fit === "fill" ? 0 : Math.min(rect.width / naturalWidth, rect.height / naturalHeight);
  const renderedWidth = fit === "fill" ? rect.width : naturalWidth * scale;
  const renderedHeight = fit === "fill" ? rect.height : naturalHeight * scale;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;
  return tags.map(tag => ({
    ...tag,
    left: rect.left + offsetX + tag.x * renderedWidth,
    top: rect.top + offsetY + tag.y * renderedHeight,
    boxWidth: tag.width * renderedWidth,
    boxHeight: tag.height * renderedHeight
  })).filter(tag => tag.left + tag.boxWidth > rect.left && tag.left < rect.right && tag.top + tag.boxHeight > rect.top && tag.top < rect.bottom);
}

export function PhotoFaceHoverLayer() {
  const cache = useRef(new Map<string, Tag[]>());
  const activeImage = useRef<HTMLImageElement | null>(null);
  const hideTimer = useRef<number | null>(null);
  const [positioned, setPositioned] = useState<Positioned[]>([]);

  useEffect(() => {
    let disposed = false;
    async function show(image: HTMLImageElement) {
      const mediaId = image.dataset.mediaId;
      if (!mediaId) return;
      activeImage.current = image;
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      let tags = cache.current.get(mediaId);
      if (!tags) {
        const response = await fetch(`/api/photo-face-tags?mediaId=${encodeURIComponent(mediaId)}`, { cache: "force-cache" }).catch(() => null);
        const body = response?.ok ? await response.json().catch(() => ({})) : {};
        const fetchedTags: Tag[] = Array.isArray(body.tags) ? body.tags : [];
        tags = fetchedTags;
        cache.current.set(mediaId, fetchedTags);
      }
      if (!disposed && activeImage.current === image) setPositioned(positionTags(image, tags ?? []));
    }
    function imageFrom(target: EventTarget | null) {
      return target instanceof Element ? target.closest<HTMLImageElement>("img[data-media-id]") : null;
    }
    function enter(event: Event) { const image = imageFrom(event.target); if (image) void show(image); }
    function leave(event: Event) {
      const image = imageFrom(event.target);
      if (!image || image !== activeImage.current) return;
      hideTimer.current = window.setTimeout(() => { activeImage.current = null; setPositioned([]); }, 100);
    }
    function touch(event: PointerEvent) {
      if (event.pointerType !== "touch") return;
      const image = imageFrom(event.target);
      if (!image) return;
      void show(image);
      hideTimer.current = window.setTimeout(() => { activeImage.current = null; setPositioned([]); }, 3000);
    }
    function reposition() { if (activeImage.current) setPositioned(positionTags(activeImage.current, cache.current.get(activeImage.current.dataset.mediaId || "") ?? [])); }
    document.addEventListener("pointerover", enter, true);
    document.addEventListener("pointerout", leave, true);
    document.addEventListener("focusin", enter, true);
    document.addEventListener("focusout", leave, true);
    document.addEventListener("pointerdown", touch, true);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      disposed = true;
      document.removeEventListener("pointerover", enter, true); document.removeEventListener("pointerout", leave, true);
      document.removeEventListener("focusin", enter, true); document.removeEventListener("focusout", leave, true);
      document.removeEventListener("pointerdown", touch, true); window.removeEventListener("scroll", reposition, true); window.removeEventListener("resize", reposition);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  return <div className="photoFaceHoverLayer" aria-live="polite">{positioned.map(tag => <span key={tag.id} style={{ left: tag.left, top: tag.top, minWidth: Math.max(44, tag.boxWidth), minHeight: Math.max(28, tag.boxHeight) }}><b>{tag.name}</b></span>)}</div>;
}
