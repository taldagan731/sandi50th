"use client";

import { useEffect, useRef } from "react";

type AuroraEngineProps = {
  intensity?: number;
  speed?: number;
  className?: string;
};

type BlobState = {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  phase: number;
  color: string;
};

export default function AuroraEngine({
  intensity = 0.9,
  speed = 1,
  className = "",
}: AuroraEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let lastTime = performance.now();

    const colors = [
      "239,154,200",
      "156,106,222",
      "111,66,193",
      "220,199,244",
      "248,221,236",
    ];

    const blobs: BlobState[] = Array.from({ length: 7 }, (_, index) => ({
      x: 0.12 + Math.random() * 0.76,
      y: 0.12 + Math.random() * 0.76,
      radius: 0.18 + Math.random() * 0.2,
      vx: (Math.random() - 0.5) * 0.00008 * speed,
      vy: (Math.random() - 0.5) * 0.00008 * speed,
      phase: Math.random() * Math.PI * 2,
      color: colors[index % colors.length],
    }));

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const drawGrain = () => {
      context.save();
      context.globalAlpha = 0.022 * intensity;
      context.fillStyle = "#ffffff";

      const grainCount = Math.floor((width * height) / 9500);

      for (let index = 0; index < grainCount; index += 1) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 1.2 + 0.2;
        context.fillRect(x, y, size, size);
      }

      context.restore();
    };

    const draw = (time: number) => {
      const delta = Math.min(40, time - lastTime);
      lastTime = time;

      context.clearRect(0, 0, width, height);

      const background = context.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, "#09080d");
      background.addColorStop(0.48, "#100c17");
      background.addColorStop(1, "#09080d");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.save();
      context.globalCompositeOperation = "screen";

      blobs.forEach((blob, index) => {
        if (!reducedMotion) {
          blob.x += blob.vx * delta;
          blob.y += blob.vy * delta;
          blob.phase += 0.00028 * delta * speed;

          if (blob.x < -0.05 || blob.x > 1.05) blob.vx *= -1;
          if (blob.y < -0.05 || blob.y > 1.05) blob.vy *= -1;
        }

        const driftX = Math.sin(blob.phase + index) * 0.035;
        const driftY = Math.cos(blob.phase * 0.82 + index) * 0.03;
        const centerX = (blob.x + driftX) * width;
        const centerY = (blob.y + driftY) * height;
        const radius = blob.radius * Math.max(width, height);

        const gradient = context.createRadialGradient(
          centerX,
          centerY,
          radius * 0.04,
          centerX,
          centerY,
          radius
        );

        gradient.addColorStop(0, `rgba(${blob.color},${0.24 * intensity})`);
        gradient.addColorStop(0.35, `rgba(${blob.color},${0.13 * intensity})`);
        gradient.addColorStop(1, `rgba(${blob.color},0)`);

        context.fillStyle = gradient;
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.fill();
      });

      context.restore();

      const vignette = context.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.15,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.62)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);

      drawGrain();

      if (!reducedMotion) {
        animationFrame = requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    if (reducedMotion) {
      draw(performance.now());
    } else {
      animationFrame = requestAnimationFrame(draw);
    }

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
    };
  }, [intensity, speed]);

  return (
    <div className={`aurora-engine ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="aurora-engine__veil" />

      <style jsx>{`
        .aurora-engine {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          background: #09080d;
        }

        canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
        }

        .aurora-engine__veil {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              180deg,
              rgba(9, 8, 13, 0.08),
              rgba(9, 8, 13, 0.22) 62%,
              rgba(9, 8, 13, 0.68)
            ),
            radial-gradient(
              circle at center,
              transparent 0%,
              rgba(9, 8, 13, 0.08) 48%,
              rgba(9, 8, 13, 0.48) 100%
            );
        }

        @media (prefers-reduced-motion: reduce) {
          .aurora-engine {
            background:
              radial-gradient(circle at 24% 32%, rgba(239, 154, 200, 0.22), transparent 28%),
              radial-gradient(circle at 72% 28%, rgba(156, 106, 222, 0.22), transparent 30%),
              radial-gradient(circle at 55% 74%, rgba(111, 66, 193, 0.16), transparent 28%),
              #09080d;
          }

          canvas {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
