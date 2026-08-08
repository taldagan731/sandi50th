import { upload } from "@vercel/blob/client";

const base = (process.env.SANDI_BASE_URL || "https://www.sandi50th.com").replace(/\/$/, "");
const contentType = "image/jpeg";
const originalName = "CODEX-LIVE-SMOKE-DELETE.jpg";
const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EB//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EB//2Q==", "base64");

async function request(path, init) {
  const response = await fetch(base + path, init);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return body;
}

const release = await request("/api/release");
if (release.release !== "august-11-reveal") throw new Error("Production release marker is not current.");
if (process.env.GITHUB_SHA && release.commit !== process.env.GITHUB_SHA) {
  throw new Error(`Production serves ${release.commit}, not expected commit ${process.env.GITHUB_SHA}.`);
}

const prepared = await request("/api/submissions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "CODEX LIVE SMOKE — DELETE",
    contact: "uploads@sandi50th.com",
    relationship: "Automated production verification",
    firstMemory: "Automated reliability test; delete this contribution.",
    story: "This record proves the public contribution, direct upload, completion, and backup path.",
    approximateYear: "2026",
    place: "Production smoke test",
    people: "",
    lifeChapter: "Not sure",
    prompt: "Automated test",
    consent: true,
    files: [{ name: originalName, type: contentType, size: jpeg.byteLength }]
  })
});

const target = prepared.uploads[0];
const tokenPayload = {
  submissionId: prepared.submissionId,
  originalName,
  bytes: jpeg.byteLength,
  contentType
};
const blob = await upload(target.pathname, new Blob([jpeg], { type: contentType }), {
  access: "private",
  handleUploadUrl: `${base}/api/uploads`,
  clientPayload: JSON.stringify(tokenPayload),
  contentType
});

const completed = await request("/api/submissions/complete", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    submissionId: prepared.submissionId,
    files: [{ ...blob, originalName, bytes: jpeg.byteLength, contentType }]
  })
});

if (!completed.backupVerified) throw new Error(`Primary upload passed but backup did not: ${completed.backupError || "unknown"}`);
const home = await fetch(base + "/");
if (!/noindex/i.test(home.headers.get("x-robots-tag") || "")) throw new Error("Production noindex header is missing.");

console.log(JSON.stringify({
  ok: true,
  submissionId: prepared.submissionId,
  bytes: jpeg.byteLength,
  backupVerified: completed.backupVerified,
  noindex: home.headers.get("x-robots-tag")
}));
