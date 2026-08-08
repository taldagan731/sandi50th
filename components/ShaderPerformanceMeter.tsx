"use client";

import { useEffect, useState } from "react";

type Result = { fps: number; longTaskMs: number; droppedFrames: number };

export function ShaderPerformanceMeter({ sampleKey }: { sampleKey: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(reduceMotion);
    if (reduceMotion) return;
    setResult(null);
    let frames = 0;
    let droppedFrames = 0;
    let last = performance.now();
    const start = last;
    let raf = 0;
    let longTaskMs = 0;
    const observer = "PerformanceObserver" in window
      ? new PerformanceObserver(entries => {
          for (const entry of entries.getEntries()) longTaskMs += entry.duration;
        })
      : null;
    try { observer?.observe({ type: "longtask", buffered: true }); } catch { /* not supported */ }

    const sample = (now: number) => {
      frames += 1;
      const interval = now - last;
      if (interval > 25) droppedFrames += Math.max(1, Math.round(interval / 16.67) - 1);
      last = now;
      if (now - start < 5000) raf = requestAnimationFrame(sample);
      else {
        const seconds = (now - start) / 1000;
        setResult({ fps: Math.round(frames / seconds), longTaskMs: Math.round(longTaskMs), droppedFrames });
        observer?.disconnect();
      }
    };
    raf = requestAnimationFrame(sample);
    return () => { cancelAnimationFrame(raf); observer?.disconnect(); };
  }, [sampleKey]);
  return (
    <p className="shaderMetrics" aria-live="polite">
      {reduced
        ? "Motion is reduced on this device: the shader is off and the static gradient is showing."
        : result
          ? `This device: ${result.fps} fps | ${result.longTaskMs} ms of long tasks | ${result.droppedFrames} estimated dropped frames in 5 seconds.`
          : "Measuring this device for 5 seconds..."}
    </p>
  );
}
