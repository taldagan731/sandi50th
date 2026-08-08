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
requireText("components/RevealExperience.tsx", "RevealSoundtrack", "the reveal soundtrack");
requireText("components/RevealExperience.tsx", "ducked={activeRecordingId !== null}", "automatic soundtrack ducking");
requireText("components/RevealExperience.tsx", "data-reveal-photo=\"true\"", "tap-to-expand reveal photographs");
requireText("components/RevealSoundtrack.tsx", "NEXT_PUBLIC_REVEAL_SOUNDTRACK_URL", "the configurable reveal soundtrack");
forbidText("components/OpeningExperience.tsx", "framer-motion", "the removed homepage animation dependency");
requireText("components/StoryStudio.tsx", "Open reveal publicly", "the no-deploy reveal access control");
requireText("components/StoryStudio.tsx", "Hide contribution", "the exception-only exclusion control");
requireText("components/StoryStudio.tsx", "20_000", "the twenty-second Studio live polling interval");
requireText("components/StudioLiveFeed.tsx", "Everything, as it comes in.", "the chronological live arrivals feed");
requireText("components/StudioLiveFeed.tsx", "newArrival", "the new-since-last-look marker");
requireText("lib/studio/auth.ts", "refreshSession", "the refreshable owner session");
requireText("lib/studio/auth.ts", ".sandi50th.com", "the apex/www production owner cookie");
requireText("app/api/studio/session/route.ts", "refreshToken", "the refresh token handoff");
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
requireText("lib/photo-intelligence/index.ts", "exifUpdateError", "EXIF persistence before AI analysis");
requireText("lib/photo-intelligence/index.ts", "prepareGlobalPhotoPilot", "the global ten-photo pilot");
requireText("app/api/internal/photo-intelligence/route.ts", "before.remaining === 0", "the pilot stop gate");
forbidText("app/api/submissions/complete/route.ts", "processPhotoAnalysisJobs", "inline full-archive photo processing");
requireText("app/api/submissions/complete/route.ts", "sendContributionArrivalEmail", "arrival email scheduling");
requireText("lib/notifications/contribution-email.ts", "CONTRIBUTION_ALERT_EMAIL", "explicit arrival-email recipient configuration");
requireText("app/api/studio/notifications/test/route.ts", "requireStudioOwner", "owner authentication for arrival-email testing");
requireText("app/api/studio/notifications/test/route.ts", "sendContributionArrivalEmail", "the owner-triggered Resend delivery test");

requireText("lib/family-qa.ts", "FAMILY_QA_SEED", "the structured family Q&A seed");
requireText("lib/family-qa.ts", "FAMILY_QA_PENDING", "the unanswered-family follow-up list");
forbidText("lib/family-qa.ts", "@yahoo.com", "a private source email address");
forbidText("lib/family-qa.ts", "@hotmail.com", "a private source email address");
forbidText("lib/family-qa.ts", "(212) 585-3242", "the unrelated medical signature");
requireText("app/api/studio/family-qa/route.ts", "requireStudioOwner", "owner authentication for Family Q&A");
requireText("app/api/studio/family-qa/route.ts", '.eq("status", "family_qa")', "Family Q&A record isolation");
requireText("components/FamilyQaStudio.tsx", "Add the supplied family Q&A", "the idempotent supplied-material import");
requireText("components/FamilyQaStudio.tsx", "Linked photographs", "photograph linking");
requireText("components/RevealExperience.tsx", "ChapterFamilyVoices", "family voices woven into chapters");
requireText("components/RevealExperience.tsx", "FamilyChorus", "the sequential family chorus");
requireText("app/reveal/page.tsx", "decodeFamilyQaMetadata", "private reveal Family Q&A loading");
forbidText("app/page.tsx", "FAMILY_QA_SEED", "private family Q&A on the public homepage");

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


const contributionForm = read("components/MemoryContributionForm.tsx");
forbidText("components/MemoryContributionForm.tsx", "calculateFileSha256", "no contributor-path hashing");
forbidText("components/MemoryContributionForm.tsx", "crypto.subtle", "no browser hashing");
forbidText("app/api/submissions/complete/route.ts", "duplicateMarkerExists", "no confirmation-path dedupe");
forbidText("app/api/submissions/complete/route.ts", "del(", "no post-upload deletion");
requireText("app/api/submissions/complete/route.ts", "enqueueSubmissionHashing", "background duplicate hash queue");
requireText("lib/duplicate-detection/index.ts", "differenceHash", "direct dependency-free dHash");
requireText("lib/duplicate-detection/index.ts", "dhash_band_0", "indexed perceptual hash bands");
requireText("supabase/duplicate-detection-migration.sql", "canonical_media_id", "reversible canonical photo link");
requireText("components/PostUploadPhotoReview.tsx", "If you do nothing, we’ll keep yours.", "default-keep contributor wording");
requireText("components/PostUploadPhotoReview.tsx", "Your original remains safely stored", "non-destructive contributor decision");
requireText("components/DuplicateReviewStudio.tsx", "originals remain stored", "non-destructive Studio merge");
const successIndex = contributionForm.indexOf("confirmationCode");
const comparisonIndex = contributionForm.indexOf("<PostUploadPhotoReview");
if (successIndex < 0 || comparisonIndex < successIndex) {
  failures.push("post-upload comparison must render only after the success confirmation");
}


if (failures.length) {
  console.error("\nReveal freeze check failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Reveal freeze check passed: privacy, deadline, default visibility, reveal gating, contribution paths, media safety, post-storage duplicate handling, backup proof, and exact-deployment smoke are intact.");
