import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const { data: project, error: projectError } = await supabase.from("projects").select("id").eq("slug", "sandi50th").single();
if (projectError || !project) throw projectError || new Error("Project missing");

const { data: submissions, error: submissionError } = await supabase
  .from("submissions")
  .select("id,name,relationship,prompt,first_memory,story,location,life_chapter,status,review_status,created_at")
  .eq("project_id", project.id);
if (submissionError) throw submissionError;

const ids = submissions.map(item => item.id);
const { data: media, error: mediaError } = await supabase
  .from("media_assets")
  .select("id,submission_id,original_name,mime_type,caption,chapter_number,review_status,created_at")
  .in("submission_id", ids);
if (mediaError) throw mediaError;

const mediaBySubmission = new Map();
for (const item of media) {
  const list = mediaBySubmission.get(item.submission_id) || [];
  list.push(item);
  mediaBySubmission.set(item.submission_id, list);
}
const fields = ["name", "relationship", "prompt", "first_memory", "story", "location", "life_chapter"];
const sandy = submissions.flatMap(item => fields.flatMap(field => /\bSandy\b/i.test(item[field] || "") ? [{ id: item.id, field, value: item[field], media: mediaBySubmission.get(item.id) || [] }] : []));
const normalizedText = value => String(value || "").replace(/\s+/g, " ").trim();
const emptyOrSingle = submissions.filter(item => item.status !== "family_qa" && [item.first_memory, item.story].some(value => { const text = normalizedText(value); return text.length > 0 && text.replace(/[^a-z0-9]/gi, "").length <= 1; }));
const textWithMedia = submissions.filter(item => {
  const attached = mediaBySubmission.get(item.id) || [];
  const text = [normalizedText(item.first_memory), normalizedText(item.story)].filter(Boolean).join(" ");
  return attached.some(asset => asset.mime_type?.startsWith("image/")) && text.length > 0;
}).map(item => ({ ...item, media: mediaBySubmission.get(item.id) || [] }));

console.log(JSON.stringify({ sandy, emptyOrSingle, textWithMedia, totals: { submissions: submissions.length, media: media.length } }, null, 2));
