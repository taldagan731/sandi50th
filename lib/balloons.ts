"use client";

const WARM_BALLOONS = [
  ["#ff746d", "#ffd0b0"],
  ["#f2aa3e", "#ffe5a3"],
  ["#f5d29b", "#fff2d2"],
  ["#72d6ac", "#d4ffe8"],
  ["#929cff", "#e1e4ff"]
] as const;

function motionAllowed() {
  return typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function launchWarmBalloons() {
  if (!motionAllowed()) return;
  const { balloons } = await import("balloons-js");
  const existing = new Set(document.querySelectorAll("balloons"));
  void balloons();
  requestAnimationFrame(() => {
    const stage = Array.from(document.querySelectorAll<HTMLElement>("balloons")).find(item => !existing.has(item));
    if (!stage) return;
    stage.classList.add("sandiBalloons");
    const limit = window.matchMedia("(max-width: 640px)").matches ? 3 : 5;
    Array.from(stage.querySelectorAll<HTMLElement>("balloon")).forEach((balloon, index) => {
      if (index >= limit) {
        balloon.remove();
        return;
      }
      const [color, light] = WARM_BALLOONS[index % WARM_BALLOONS.length];
      balloon.style.setProperty("--balloon-color", color);
      balloon.style.setProperty("--light-color", light);
    });
  });
}

export function fireContributionBalloons() {
  void launchWarmBalloons().catch(() => undefined);
}

export function fireRevealFinaleBalloons() {
  void launchWarmBalloons().catch(() => undefined);
}

export function fireRevealOpeningBalloons() {
  if (!motionAllowed()) return;
  void import("balloons-js").then(({ textBalloons }) => {
    textBalloons([{ text: "50", color: "#ff806f", fontSize: window.innerWidth <= 640 ? 112 : 176 }]);
    requestAnimationFrame(() => document.querySelectorAll<HTMLElement>("text-balloons").forEach(stage => stage.classList.add("sandiTextBalloons")));
  }).catch(() => undefined);
}
