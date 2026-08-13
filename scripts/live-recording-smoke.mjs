import fs from "node:fs";
import { upload } from "@vercel/blob/client";

const base = (process.env.SANDI_BASE_URL || "https://www.sandi50th.com").replace(/\/$/, "");
const fixtureRoot = new URL("../../work/", import.meta.url);
const cases = [
  { label: "iOS MediaRecorder audio/mp4", file: "smoke-audio.m4a", type: "audio/mp4", prompt: "VOICE_WALL", chapter: "Sandi today" },
  { label: "iPhone Voice Memos audio/x-m4a", file: "smoke-audio.m4a", type: "audio/x-m4a", prompt: "VOICE_WALL", chapter: "Sandi today" },
  { label: "Chrome MediaRecorder audio/webm", file: "smoke-audio.webm", type: "audio/webm", prompt: "VOICE_WALL", chapter: "Sandi today" },
  { label: "iOS birthday video/mp4", file: "smoke-video.mp4", type: "video/mp4", prompt: "BIRTHDAY_MESSAGE", chapter: "Birthday wishes" },
  { label: "Chrome birthday video/webm", file: "smoke-video.webm", type: "video/webm", prompt: "BIRTHDAY_MESSAGE", chapter: "Birthday wishes" }
];

async function request(path, init) {
  const response = await fetch(base + path, init);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return body;
}

const results = [];
for (const item of cases) {
  const bytes = fs.readFileSync(new URL(item.file, fixtureRoot));
  const prepared = await request("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "CODEX LIVE RECORDING SMOKE — DELETE",
      contact: "uploads@sandi50th.com",
      relationship: "Automated production verification",
      firstMemory: item.prompt === "BIRTHDAY_MESSAGE" ? "A birthday message recorded for Sandi." : "A voice memory recorded for Sandi.",
      story: item.label,
      approximateYear: "2026",
      place: "Production smoke test",
      people: "",
      lifeChapter: item.chapter,
      prompt: item.prompt,
      consent: true,
      files: [{ name: item.file, type: item.type, size: bytes.byteLength }]
    })
  });
  const target = prepared.uploads[0];
  const blob = await upload(target.pathname, new Blob([bytes], { type: item.type }), {
    access: "private",
    handleUploadUrl: `${base}/api/uploads`,
    clientPayload: JSON.stringify({ submissionId: prepared.submissionId, originalName: item.file, bytes: bytes.byteLength, contentType: item.type }),
    contentType: item.type
  });
  const completed = await request("/api/submissions/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId: prepared.submissionId, files: [{ ...blob, originalName: item.file, bytes: bytes.byteLength, contentType: item.type }] })
  });
  results.push({ label: item.label, submissionId: prepared.submissionId, bytes: bytes.byteLength, fileCount: completed.fileCount, mediaAssetIds: completed.mediaAssetIds, backupVerified: completed.backupVerified, backupError: completed.backupError });
}
console.log(JSON.stringify({ ok: results.every(item => item.fileCount === 1 && item.mediaAssetIds?.length === 1 && item.backupVerified), base, results }, null, 2));
