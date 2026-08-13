import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Production Supabase configuration is incomplete.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const since = new Date(Date.now() - 14 * 86400000).toISOString();
const { data: submissions, error: submissionError } = await db
  .from("submissions")
  .select("id,name,prompt,first_memory,status,review_status,created_at,upload_completed_at")
  .gte("created_at", since)
  .order("created_at", { ascending: false });
if (submissionError) throw submissionError;

const media = [];
const ids = submissions.map(item => item.id);
for (let index = 0; index < ids.length; index += 100) {
  const { data, error } = await db
    .from("media_assets")
    .select("id,submission_id,original_name,mime_type,bytes,storage_path,review_status,created_at")
    .in("submission_id", ids.slice(index, index + 100));
  if (error) throw error;
  media.push(...data);
}

const bySubmission = new Map();
for (const item of media) {
  const list = bySubmission.get(item.submission_id) || [];
  list.push(item);
  bySubmission.set(item.submission_id, list);
}
const isRecording = item => ["VOICE_WALL", "BIRTHDAY_MESSAGE", "NAME_CHORUS"].includes((item.prompt || "").toUpperCase()) || /recorded for Sandi|voice memory|birthday message/i.test(item.first_memory || "");
const summarize = item => {
  const files = bySubmission.get(item.id) || [];
  return {
    id: item.id,
    name: item.name,
    prompt: item.prompt,
    status: item.status,
    reviewStatus: item.review_status,
    createdAt: item.created_at,
    completedAt: item.upload_completed_at,
    mediaCount: files.length,
    media: files.map(file => ({ id: file.id, name: file.original_name, type: file.mime_type, bytes: file.bytes, reviewStatus: file.review_status, path: file.storage_path }))
  };
};
const recordingRows = submissions.filter(isRecording).map(summarize);
const incompleteRecordings = recordingRows.filter(item => !item.completedAt || item.status !== "uploaded" || item.mediaCount === 0);
const incompleteAll = submissions.map(summarize).filter(item => !item.completedAt || item.status !== "uploaded" || item.mediaCount === 0);
console.log(JSON.stringify({
  since,
  recentSubmissionCount: submissions.length,
  recentMediaCount: media.length,
  recordingCount: recordingRows.length,
  completedRecordings: recordingRows.filter(item => item.completedAt && item.status === "uploaded" && item.mediaCount > 0),
  incompleteRecordings,
  uploadedRecordingsWithoutMedia: recordingRows.filter(item => item.status === "uploaded" && item.mediaCount === 0),
  incompleteAll
}, null, 2));
