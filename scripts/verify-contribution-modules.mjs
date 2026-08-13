import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { upload } from "@vercel/blob/client";

const base = process.env.CONTRIBUTION_TEST_BASE || "https://www.sandi50th.com";
const fixtures = process.argv.slice(2);

async function jsonRequest(path, init) {
  const response = await fetch(base + path, init);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${body.error || text}`);
  return body;
}

async function runModule(label, fixturePath, contentType, payloadType = contentType) {
  const fileBytes = fixturePath ? await readFile(fixturePath) : null;
  const fileName = fixturePath ? `CODEX-${label}-${basename(fixturePath)}` : null;
  const files = fileBytes ? [{ name: fileName, type: contentType, size: fileBytes.length }] : [];
  const initialized = await jsonRequest("/api/submissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceType: "contributor",
      name: `CODEX ${label.toUpperCase()} MODULE TEST`,
      contact: "automated-test@sandi50th.invalid",
      relationship: "Other",
      firstMemory: `Automated excluded ${label} module verification`,
      story: "",
      approximateYear: "",
      place: "",
      people: "",
      lifeChapter: "Not sure",
      prompt: "AUTOMATED_MODULE_TEST",
      consent: true,
      files
    })
  });

  const completedFiles = [];
  if (fileBytes) {
    const target = initialized.uploads[0];
    const file = new File([fileBytes], fileName, { type: contentType });
    const blob = await upload(target.pathname, file, {
      access: "private",
      handleUploadUrl: base + "/api/uploads",
      clientPayload: JSON.stringify({
        submissionId: initialized.submissionId,
        originalName: fileName,
        bytes: fileBytes.length,
        contentType: payloadType
      }),
      contentType,
      multipart: false
    });
    completedFiles.push({ ...blob, originalName: fileName, bytes: fileBytes.length });
  }

  const completed = await jsonRequest("/api/submissions/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ submissionId: initialized.submissionId, files: completedFiles })
  });
  if (!completed.backupVerified) throw new Error(`${label} stored but backup verification failed: ${completed.backupError}`);
  return { module: label, pass: true, submissionId: initialized.submissionId, files: completed.fileCount, backup: completed.backupVerified };
}

if (fixtures.length !== 6) {
  console.error("Usage: node scripts/verify-contribution-modules.mjs <jpg> <heic> <m4a> <webm-audio> <mp4> <webm-video>");
  process.exit(2);
}

const tests = [
  ["text", null, null],
  ["photo-jpeg", fixtures[0], "image/jpeg"],
  ["iphone-photo-heic", fixtures[1], "image/heic"],
  ["iphone-audio-m4a", fixtures[2], "audio/mp4", "audio/mp4;codecs=mp4a.40.2"],
  ["chrome-audio-webm", fixtures[3], "audio/webm"],
  ["iphone-video-mp4", fixtures[4], "video/mp4", "video/mp4;codecs=avc1.42E01E,mp4a.40.2"],
  ["android-video-webm", fixtures[5], "video/webm", "video/webm;codecs=vp8,opus"]
];

const results = [];
for (const test of tests) {
  try {
    results.push(await runModule(...test));
  } catch (error) {
    results.push({ module: test[0], pass: false, error: error instanceof Error ? error.message : String(error) });
  }
}
console.table(results);
if (results.some(result => !result.pass)) process.exit(1);

