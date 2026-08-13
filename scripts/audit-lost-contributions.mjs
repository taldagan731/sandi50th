import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Production Supabase configuration is incomplete.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: submissions, error: submissionError } = await db
  .from("submissions")
  .select("id,name,contact,relationship,first_memory,story,prompt,life_chapter,status,review_status,created_at,upload_completed_at")
  .order("created_at", { ascending: true });
if (submissionError) throw submissionError;

const media = [];
for (let index = 0; index < submissions.length; index += 100) {
  const ids = submissions.slice(index, index + 100).map(row => row.id);
  const { data, error } = await db.from("media_assets")
    .select("id,submission_id,original_name,mime_type,bytes,storage_path,created_at")
    .in("submission_id", ids);
  if (error) throw error;
  media.push(...data);
}

const bySubmission = new Map();
for (const asset of media) {
  const list = bySubmission.get(asset.submission_id) || [];
  list.push(asset);
  bySubmission.set(asset.submission_id, list);
}

const isTest = row => /CODEX|MOBILE TEST/i.test(row.name || "") || /AUTOMATED_MODULE_TEST/i.test(row.prompt || "");
const isOwner = row => /owner archive/i.test([row.name, row.relationship, row.prompt].filter(Boolean).join(" "));
const kind = row => {
  const assets = bySubmission.get(row.id) || [];
  if (assets.some(asset => asset.mime_type?.startsWith("video/"))) return "video";
  if (assets.some(asset => asset.mime_type?.startsWith("audio/"))) return "audio";
  if (assets.some(asset => asset.mime_type?.startsWith("image/"))) return "photo";
  const words = [row.prompt, row.first_memory, row.story].filter(Boolean).join(" ");
  if (/voice|record/i.test(words)) return "attempted audio";
  if (/video|birthday message/i.test(words)) return "attempted video";
  return "text or unknown";
};
const summarize = row => {
  const assets = bySubmission.get(row.id) || [];
  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    contact: row.contact,
    kind: kind(row),
    status: row.status,
    reviewStatus: row.review_status,
    completedAt: row.upload_completed_at,
    recoverableText: Boolean((row.first_memory || "").trim() || (row.story || "").trim()),
    firstMemory: row.first_memory,
    mediaCount: assets.length,
    media: assets.map(asset => ({ id: asset.id, name: asset.original_name, type: asset.mime_type, bytes: asset.bytes, path: asset.storage_path }))
  };
};

const real = submissions.filter(row => !isTest(row) && !isOwner(row));
const incomplete = real.filter(row => !row.upload_completed_at || row.status === "received").map(summarize);
const recoverableMedia = incomplete.filter(row => row.mediaCount > 0);
const noMediaReached = incomplete.filter(row => row.mediaCount === 0);
const completed = real.filter(row => row.upload_completed_at && row.status !== "received").map(summarize);

const duplicateAttempts = [];
for (const row of noMediaReached) {
  const created = new Date(row.createdAt).getTime();
  const later = completed.find(candidate => {
    const sameIdentity = (row.contact && row.contact !== "Not provided" && candidate.contact === row.contact) ||
      (row.name && row.name !== "Not provided" && candidate.name?.toLowerCase() === row.name.toLowerCase());
    const delta = new Date(candidate.createdAt).getTime() - created;
    return sameIdentity && delta >= 0 && delta <= 24 * 60 * 60 * 1000;
  });
  if (later) duplicateAttempts.push({ incompleteId: row.id, completedId: later.id, name: row.name, contact: row.contact, kind: row.kind });
}

console.log(JSON.stringify({
  auditedAt: new Date().toISOString(),
  totals: {
    submissions: submissions.length,
    media: media.length,
    realContributions: real.length,
    completeReal: completed.length,
    incompleteReal: incomplete.length,
    incompleteWithRecoverableMedia: recoverableMedia.length,
    incompleteWithNoMedia: noMediaReached.length,
    likelyRetriedSuccessfully: duplicateAttempts.length
  },
  recoverableMedia,
  noMediaReached,
  likelyRetriedSuccessfully: duplicateAttempts
}, null, 2));
