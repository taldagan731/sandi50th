"use client";

const WARM_CONFETTI_COLORS = [
  "#D7AE52",
  "#F4E4BC",
  "#C98A32",
  "#FFF7E6",
  "#B96F2E"
] as const;

type CelebrationKind = "contribution" | "reveal-finale";

function motionIsReduced() {
  return (
    typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

async function launchCelebration(kind: CelebrationKind) {
  if (motionIsReduced()) return;

  const isSmallScreen = window.matchMedia("(max-width: 640px)").matches;
  const { default: confetti } = await import("canvas-confetti");

  confetti({
    angle: 90,
    colors: [...WARM_CONFETTI_COLORS],
    decay: 0.92,
    disableForReducedMotion: true,
    drift: 0,
    gravity: kind === "contribution" ? 0.78 : 0.72,
    origin: { x: 0.5, y: kind === "contribution" ? 0.82 : 0.78 },
    particleCount:
      kind === "contribution"
        ? isSmallScreen
          ? 18
          : 30
        : isSmallScreen
          ? 26
          : 42,
    scalar: isSmallScreen ? 0.72 : 0.82,
    shapes: ["circle", "square"],
    spread: kind === "contribution" ? 56 : 64,
    startVelocity: kind === "contribution" ? 25 : 29,
    ticks: kind === "contribution" ? 140 : 160,
    zIndex: 1200
  });
}

export function fireContributionConfetti() {
  void launchCelebration("contribution").catch(() => undefined);
}

export function fireRevealFinaleConfetti() {
  void launchCelebration("reveal-finale").catch(() => undefined);
}
