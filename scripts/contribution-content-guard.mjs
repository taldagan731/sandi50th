import { readFileSync } from "node:fs";

const failures = [];
const intakeSources = [
  "lib/chapters.ts",
  "app/api/submissions/route.ts",
  "app/api/submissions/complete/route.ts",
  "app/api/uploads/route.ts",
  "app/api/name-chorus/start/route.ts",
  "app/api/name-chorus/complete/route.ts"
];

const prohibitedContentFilters = [
  [/bad[-_ ]?words?/i, "a bad-word filter"],
  [/containsProfanity|profanityFilter|filterProfanity|censorProfanity/i, "a profanity detector"],
  [/moderateText|toxicityScore|contentModerationResult/i, "a text-moderation gate"]
];

const revealAvailabilityCoupling = /reveal_public|revealPublic|isRevealPublic|submission_deadline/i;

for (const path of intakeSources) {
  const source = readFileSync(path, "utf8");
  for (const [pattern, label] of prohibitedContentFilters) {
    if (pattern.test(source)) failures.push(`${path} introduces ${label} into contribution intake.`);
  }
  if (revealAvailabilityCoupling.test(source)) {
    failures.push(`${path} couples contribution intake to reveal publication or a deadline.`);
  }
}

const visibilitySource = readFileSync("lib/chapters.ts", "utf8");
const testOnlyDefault = 'return isTestContributor(name) ? "excluded" as const : "included" as const;';
if (!visibilitySource.includes(testOnlyDefault)) {
  failures.push("Contribution visibility is no longer the test-record-only default.");
}

const familySource = readFileSync("lib/family-qa.ts", "utf8");
if (familySource.includes("showInChapter: false")) {
  failures.push("A supplied family answer is hidden from its chapter by default.");
}

for (const path of ["app/api/studio/review/route.ts", "app/api/studio/submission-review/route.ts"]) {
  const source = readFileSync(path, "utf8");
  if (!source.includes("requireStudioAccess")) {
    failures.push(`${path} permits exclusion without the private owner gate.`);
  }
}

if (failures.length) {
  console.error(failures.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("Contribution content guard passed: wording never controls storage or default visibility; only test records and private owner exclusion can hide content.");
