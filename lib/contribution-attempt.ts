"use client";

export type ContributionPath = "memory" | "photos" | "voice" | "birthday";

function attemptId() {
  const key = "sandi-contribution-attempt";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

export function trackContributionStep(path: ContributionPath, step: number, event: "selected" | "step" | "completed" = "step") {
  if (typeof window === "undefined") return;
  void fetch("/api/contribution-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attemptId: attemptId(), path, step, event }),
    keepalive: true
  }).catch(() => undefined);
}
