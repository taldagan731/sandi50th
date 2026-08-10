"use client";

import { useEffect, useRef, useState } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  color: string;
  phase: number;
};

const CREDIT_LINES = [
  "Developed by Tal Dagan",
  "Co-producers: Jenny Banayan, Beth Baluarte, and Shiry Yoseph",
];

const PARTICLE_COLORS = ["#fff4dc", "#ffd39d", "#ffae94", "#f5b9d8", "#c9c6ff"];

function fitFont(context: CanvasRenderingContext2D, text: string, preferred: number, maximumWidth: number) {
  let size = preferred;
  while (size > 9) {
    context.font = `700 ${size}px Georgia, "Times New Roman", serif`;
    if (context.measureText(text).width <= maximumWidth) break;
    size -= 1;
  }
  return size;
}

export function ParticleTextEffect() {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!frame || !canvas || !context || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let particles: Particle[] = [];
    let animationFrame = 0;
    let lastPaint = 0;
    let onScreen = true;
    let resizeTimer = 0;
    let resolveTimer = 0;
    let cycleTimer = 0;
    let renderRatio = 1;

    const stopCycleTimers = () => {
      window.clearTimeout(resolveTimer);
      window.clearTimeout(cycleTimer);
    };

    const scatterParticles = () => {
      const width = canvas.width / renderRatio;
      const height = parseFloat(canvas.style.height) || 138;
      for (const particle of particles) {
        particle.x = Math.random() * width;
        particle.y = Math.random() < .5 ? -24 - Math.random() * 52 : height + 24 + Math.random() * 52;
        particle.vx = (Math.random() - .5) * 3;
        particle.vy = (Math.random() - .5) * 3;
      }
    };

    const resolveAndHold = () => {
      if (!onScreen || document.hidden) return;
      setResolved(true);
      cycleTimer = window.setTimeout(beginCycle, 5600);
    };

    function beginCycle() {
      stopCycleTimers();
      if (!onScreen || document.hidden || !particles.length) return;
      setResolved(false);
      scatterParticles();
      resolveTimer = window.setTimeout(resolveAndHold, 1750);
    }

    const buildParticles = () => {
      const width = Math.max(280, Math.round(frame.clientWidth));
      const compact = width < 620;
      const height = compact ? 156 : 138;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      renderRatio = ratio;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const textCanvas = document.createElement("canvas");
      textCanvas.width = width;
      textCanvas.height = height;
      const textContext = textCanvas.getContext("2d", { willReadFrequently: true });
      if (!textContext) return;
      textContext.fillStyle = "#fff";
      textContext.textAlign = "center";
      textContext.textBaseline = "middle";

      const visualLines = compact
        ? [CREDIT_LINES[0], "Co-producers: Jenny Banayan,", "Beth Baluarte, and Shiry Yoseph"]
        : CREDIT_LINES;
      const preferredSizes = compact ? [18, 14, 14] : [29, 21];
      const lineYs = compact ? [40, 90, 116] : [45, 92];
      visualLines.forEach((line, index) => {
        const size = fitFont(textContext, line, preferredSizes[index], width - (compact ? 28 : 80));
        textContext.font = `700 ${size}px Georgia, "Times New Roman", serif`;
        textContext.fillText(line, width / 2, lineYs[index]);
      });

      const pixels = textContext.getImageData(0, 0, width, height).data;
      const step = compact ? 2 : 3;
      const nextParticles: Particle[] = [];
      let colorIndex = 0;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          if (pixels[(y * width + x) * 4 + 3] < 80) continue;
          const previous = particles[nextParticles.length];
          nextParticles.push({
            x: previous?.x ?? Math.random() * width,
            y: previous?.y ?? height + 20 + Math.random() * 70,
            vx: previous?.vx ?? 0,
            vy: previous?.vy ?? 0,
            targetX: x,
            targetY: y,
            color: PARTICLE_COLORS[colorIndex++ % PARTICLE_COLORS.length],
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
      particles = nextParticles;
      setEnhanced(true);
      beginCycle();
    };

    const paint = (time: number) => {
      animationFrame = window.requestAnimationFrame(paint);
      if (!onScreen || document.hidden || time - lastPaint < 32) return;
      lastPaint = time;
      const width = canvas.width / renderRatio;
      const height = parseFloat(canvas.style.height) || 138;
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        const driftX = Math.sin(time * 0.00065 + particle.phase) * 0.38;
        const driftY = Math.cos(time * 0.00052 + particle.phase) * 0.28;
        particle.vx = (particle.vx + (particle.targetX + driftX - particle.x) * 0.022) * 0.88;
        particle.vy = (particle.vy + (particle.targetY + driftY - particle.y) * 0.022) * 0.88;
        particle.x += particle.vx;
        particle.y += particle.vy;
        context.globalAlpha = 0.78 + Math.sin(time * 0.0012 + particle.phase) * 0.18;
        context.fillStyle = particle.color;
        context.fillRect(particle.x, particle.y, 1.8, 1.8);
      }
      context.globalAlpha = 1;
    };

    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen && !document.hidden) beginCycle();
      else stopCycleTimers();
    }, { rootMargin: "120px" });
    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(buildParticles, 120);
    });
    const handleVisibility = () => {
      if (document.hidden) stopCycleTimers();
      else if (onScreen) beginCycle();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    observer.observe(frame);
    resizeObserver.observe(frame);
    buildParticles();
    animationFrame = window.requestAnimationFrame(paint);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      window.clearTimeout(resizeTimer);
      stopCycleTimers();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <footer className={`siteCredits${enhanced ? " isEnhanced" : ""}${resolved ? " isResolved" : ""}`} aria-label="Site credits">
      <div className="siteCreditsParticleFrame" ref={frameRef}>
        <canvas className="siteCreditsCanvas" ref={canvasRef} aria-hidden="true" />
        <div className="siteCreditsFallback">
          <span>{CREDIT_LINES[0]}</span>
          <span>{CREDIT_LINES[1]}</span>
        </div>
      </div>
    </footer>
  );
}
