import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const failures = [];

function read(path) {
  const full = join(root, path);
  if (!existsSync(full)) {
    failures.push(`Missing required release file: ${path}`);
    return "";
  }
  return readFileSync(full, "utf8");
}

function requireText(path, text, label = text) {
  const content = read(path);
  if (!content.includes(text)) failures.push(`${path} is missing: ${label}`);
}

function forbidText(path, text, label = text) {
  const content = read(path);
  if (content.includes(text)) failures.push(`${path} still contains prohibited release text: ${label}`);
}

function sourceFiles(directory) {
  const full = join(root, directory);
  if (!existsSync(full)) return [];
  return readdirSync(full).flatMap(name => {
    const path = join(full, name);
    return statSync(path).isDirectory() ? sourceFiles(relative(root, path)) : [path];
  });
}

requireText("app/layout.tsx", "robots: { index: false, follow: false }", "the sitewide noindex directive");
requireText("app/robots.ts", "disallow: \"/\"", "robots exclusion");
requireText("app/page.tsx", "August 10, 2026", "the August 10 contribution deadline");
requireText("app/contribute/page.tsx", "August 10, 2026", "the August 10 contribution deadline");
requireText("components/OpeningExperience.tsx", "The way we see you.", "the present-tense hero line");
requireText("components/MemoryContributionForm.tsx", "Drop an entire album", "bulk album invitation");
requireText("components/RecordingContributionForm.tsx", "VOICE_WALL", "voice contribution path");
requireText("components/RecordingContributionForm.tsx", "BIRTHDAY_MESSAGE", "birthday message path");
requireText("components/RecordingContributionForm.tsx", "playsInline", "inline mobile recording playback");
requireText("components/RevealExperience.tsx", "The rest is yours to write.", "Chapter Nine invitation");
requireText("components/StoryStudio.tsx", "Open reveal publicly", "the no-deploy reveal access control");
requireText("components/StoryStudio.tsx", "Hide contribution", "the exception-only exclusion control");
requireText("app/reveal/page.tsx", '.neq("review_status", "excluded")', "default-visible reveal selection");
requireText("app/api/reveal/media/[id]/route.ts", "reveal_public", "the private/public reveal media gate");
requireText("app/api/studio/contributions/route.ts", "%MOBILE TEST%", "automatic test-record exclusion");
requireText("app/api/public/hero-photo/route.ts", '.not("reviewed_at", "is", null)', "public-homepage upload containment");
requireText("supabase/default-visible-reveal-migration.sql", "reveal_public boolean not null default false", "the reveal access switch migration");
forbidText("components/RecordingContributionForm.tsx", "until it is approved", "recording approval language");
requireText("components/RevealArchive.tsx", "Move through the years.", "time scrubber");
requireText("components/RevealArchive.tsx", "playsInline", "inline archive film playback");
requireText("app/api/studio/backups/route.ts", "byteCountVerified", "per-file backup byte verification");
requireText("app/api/release/route.ts", "VERCEL_GIT_COMMIT_SHA", "commit-specific release marker");
requireText(".github/workflows/post-deploy-smoke.yml", "${GITHUB_SHA}", "exact-commit production wait");
requireText("lib/photo-intelligence/index.ts", "requestAnthropic(derivative", "derivative-only photo analysis");
requireText("lib/photo-intelligence/index.ts", ".jpeg({ quality", "metadata-free derivative re-encoding");

requireText("package.json", '"canvas-confetti": "1.9.4"', "the pinned canvas-confetti dependency");
requireText("lib/confetti.ts", 'import("canvas-confetti")', "event-only dynamic confetti loading");
requireText("lib/confetti.ts", 'prefers-reduced-motion: reduce', "reduced-motion suppression");
requireText("lib/confetti.ts", "disableForReducedMotion: true", "canvas-confetti reduced-motion safeguard");
requireText("lib/confetti.ts", 'max-width: 640px', "lower mobile particle count");
forbidText("lib/confetti.ts", "requestAnimationFrame", "an application animation loop");
forbidText("lib/confetti.ts", "setInterval", "a repeating confetti timer");
requireText("components/MemoryContributionForm.tsx", "fireContributionConfetti();", "memory and photo contribution celebration");
requireText("components/RecordingContributionForm.tsx", "fireContributionConfetti();", "voice and birthday-message celebration");
requireText("components/RevealExperience.tsx", "fireRevealFinaleConfetti();", "the completed birthday-message reel celebration");

const confettiSource = [...sourceFiles("app"), ...sourceFiles("components"), ...sourceFiles("lib")]
  .filter(path => /\.(ts|tsx)$/.test(path));
const allowedConfettiCallSites = new Set([
  "lib/confetti.ts",
  "components/MemoryContributionForm.tsx",
  "components/RecordingContributionForm.tsx",
  "components/RevealExperience.tsx"
]);
const allowedConfettiModuleSites = new Set([
  "lib/confetti.ts",
  "lib/canvas-confetti.d.ts"
]);
for (const path of confettiSource) {
  const relativePath = relative(root, path).replaceAll("\\", "/");
  const content = readFileSync(path, "utf8");
  const referencesCelebration =
    content.includes("fireContributionConfetti") ||
    content.includes("fireRevealFinaleConfetti");
  if (referencesCelebration && !allowedConfettiCallSites.has(relativePath)) {
    failures.push(`${relativePath} introduces confetti outside the approved contribution and reveal-finale placements.`);
  }
  if (content.includes('"canvas-confetti"') && !allowedConfettiModuleSites.has(relativePath)) {
    failures.push(`${relativePath} imports canvas-confetti directly instead of using the guarded event helper.`);
  }
}

const publicSource = [...sourceFiles("app"), ...sourceFiles("components")]
  .filter(path => /\.(ts|tsx|css)$/.test(path));
for (const path of publicSource) {
  const content = readFileSync(path, "utf8");
  if (/August\s+7(?:,\s*2026)?/i.test(content)) failures.push(`${relative(root, path)} still contains the old August 7 deadline.`);
  if (/The way we remember you\.?/i.test(content)) failures.push(`${relative(root, path)} still frames Sandi in the past tense.`);
}

if (failures.length) {
  console.error("\nReveal freeze check failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Reveal freeze check passed: privacy, deadline, default visibility, reveal gating, contribution paths, media safety, backup proof, and exact-deployment smoke are intact.");
