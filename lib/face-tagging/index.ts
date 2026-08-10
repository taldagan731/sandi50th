import sharp from "sharp";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPrivateMedia } from "@/lib/photo-intelligence/media";
import { isTestContributor } from "@/lib/chapters";

const MODEL = process.env.ANTHROPIC_FACE_TAG_MODEL || process.env.ANTHROPIC_PHOTO_MODEL || "claude-sonnet-5";
const AUTO_CONFIRM_THRESHOLD = .97;
function migrationMissing(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /photo_face_tags|schema cache/i.test(error.message || "")));
}
const faceSchema = z.object({
  faces: z.array(z.object({
    reference: z.string().nullable(), confidence: z.number().min(0).max(1),
    x: z.number().min(0).max(1), y: z.number().min(0).max(1),
    width: z.number().positive().max(1), height: z.number().positive().max(1)
  })).max(40)
});

type Media = { id: string; submission_id: string; storage_path: string; poster_path: string | null; original_name: string; mime_type: string; review_status: string };
type Reference = { id: string; media_asset_id: string; person_name: string; x: number; y: number; width: number; height: number };

function jsonFromText(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  return faceSchema.parse(JSON.parse(fenced ?? text.slice(first, last + 1)));
}

async function mediaBuffer(media: Media) {
  const supabase = createAdminClient();
  return readPrivateMedia(supabase, media.poster_path || media.storage_path);
}

async function referenceSheet(references: Reference[], mediaById: Map<string, Media>) {
  const cells: Array<{ label: string; name: string; tagId: string; crop: Buffer }> = [];
  for (const reference of references) {
    const media = mediaById.get(reference.media_asset_id);
    if (!media) continue;
    try {
      const input = await mediaBuffer(media);
      const metadata = await sharp(input, { failOn: "none" }).metadata();
      if (!metadata.width || !metadata.height) continue;
      const left = Math.max(0, Math.min(metadata.width - 2, Math.round(reference.x * metadata.width)));
      const top = Math.max(0, Math.min(metadata.height - 2, Math.round(reference.y * metadata.height)));
      const width = Math.max(2, Math.min(metadata.width - left, Math.round(reference.width * metadata.width)));
      const height = Math.max(2, Math.min(metadata.height - top, Math.round(reference.height * metadata.height)));
      const crop = await sharp(input, { failOn: "none" }).extract({ left, top, width, height }).resize(180, 180, { fit: "cover" }).jpeg({ quality: 84 }).toBuffer();
      cells.push({ label: `R${cells.length + 1}`, name: reference.person_name, tagId: reference.id, crop });
    } catch { /* A broken reference is skipped; confirmed metadata remains intact. */ }
  }
  if (!cells.length) throw new Error("Add at least one clear confirmed face tag before starting AI matching.");
  const columns = Math.min(4, cells.length);
  const rows = Math.ceil(cells.length / columns);
  const width = columns * 210;
  const height = rows * 220;
  const composites: sharp.OverlayOptions[] = [];
  cells.forEach((cell, index) => {
    const x = (index % columns) * 210 + 15;
    const y = Math.floor(index / columns) * 220 + 10;
    composites.push({ input: cell.crop, left: x, top: y });
    composites.push({ input: Buffer.from(`<svg width="180" height="24"><text x="90" y="18" text-anchor="middle" fill="#fff" font-size="17" font-family="Arial" font-weight="700">${cell.label}</text></svg>`), left: x, top: y + 184 });
  });
  const sheet = await sharp({ create: { width, height, channels: 3, background: "#321126" } }).composite(composites).jpeg({ quality: 86 }).toBuffer();
  return { sheet, cells };
}

async function askAnthropic(target: Buffer, sheet: Buffer, legend: string) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1800,
      system: "You compare faces only within a private, owner-curated family photo archive. Match a target face only to the supplied labeled reference faces. Do not infer names, demographics, relationships, health, or any other trait. Uncertain matches must be null. Return valid JSON only.",
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: target.toString("base64") } },
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: sheet.toString("base64") } },
        { type: "text", text: `The first image is the target. The second is a reference sheet. References: ${legend}. Find visible faces in the target and compare only against those references. Coordinates must be normalized 0..1 against the entire target image. Use null when identity is uncertain. Return exactly {"faces":[{"reference":"R1 or null","confidence":0.0,"x":0.0,"y":0.0,"width":0.0,"height":0.0}]}. Confidence means same-person visual similarity, not face-detection confidence.` }
      ] }]
    })
  });
  if (!response.ok) throw new Error(`AI face comparison failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  const payload = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const text = payload.content?.find(item => item.type === "text")?.text;
  if (!text) throw new Error("AI returned no face comparison.");
  return jsonFromText(text);
}

async function photoInventory(projectId: string) {
  const supabase = createAdminClient();
  const { data: submissions, error: submissionError } = await supabase.from("submissions").select("id,name,review_status").eq("project_id", projectId);
  if (submissionError) throw submissionError;
  const ids = (submissions ?? []).filter(item => item.review_status !== "excluded" && !isTestContributor(item.name)).map(item => item.id);
  if (!ids.length) return [] as Media[];
  const { data, error } = await supabase.from("media_assets").select("id,submission_id,storage_path,poster_path,original_name,mime_type,review_status").in("submission_id", ids).neq("review_status", "excluded");
  if (error) throw error;
  return ((data ?? []) as Media[]).filter(item => String(item.mime_type).startsWith("image/"));
}

export async function faceTaggingStatus(projectId: string) {
  const supabase = createAdminClient();
  const photos = await photoInventory(projectId);
  const { data, error } = await supabase.from("photo_face_tags").select("media_asset_id,status,person_name").eq("project_id", projectId);
  if (error) {
    if (migrationMissing(error)) return { migrationRequired: true, total: photos.length, scanned: 0, remaining: photos.length, confirmed: 0, questions: 0, people: 0 };
    throw error;
  }
  const scanned = new Set((data ?? []).map(item => item.media_asset_id)).size;
  const people = new Set((data ?? []).filter(item => item.status === "confirmed" && item.person_name).map(item => item.person_name.toLowerCase())).size;
  const questionIds = [...new Set((data ?? []).filter(item => item.status === "suggested").map(item => item.media_asset_id))];
  const photoById = new Map(photos.map(photo => [photo.id, photo]));
  const questionItems = questionIds.map(mediaId => ({ mediaId, name: photoById.get(mediaId)?.original_name || "Photograph needing review" }));
  return { migrationRequired: false, total: photos.length, scanned, remaining: Math.max(0, photos.length - scanned), confirmed: (data ?? []).filter(item => item.status === "confirmed").length, questions: (data ?? []).filter(item => item.status === "suggested").length, people, questionItems };
}

export async function processNextFacePhoto(projectId: string) {
  const supabase = createAdminClient();
  const photos = await photoInventory(projectId);
  const { data: allTags, error } = await supabase.from("photo_face_tags").select("id,media_asset_id,person_name,x,y,width,height,status").eq("project_id", projectId);
  if (error) throw error;
  const taggedIds = new Set((allTags ?? []).map(item => item.media_asset_id));
  const target = photos.find(photo => !taggedIds.has(photo.id));
  if (!target) return { complete: true, mediaId: null, inserted: 0 };
  const uniqueReferences = new Map<string, Reference>();
  for (const tag of (allTags ?? []) as Array<Reference & { status: string }>) {
    if (tag.status === "confirmed" && tag.person_name && !uniqueReferences.has(tag.person_name.toLowerCase())) uniqueReferences.set(tag.person_name.toLowerCase(), tag);
  }
  if (!uniqueReferences.size) return { complete: false, seedRequired: true, mediaId: target.id, inserted: 0 };
  const mediaById = new Map(photos.map(photo => [photo.id, photo]));
  const { sheet, cells } = await referenceSheet([...uniqueReferences.values()].slice(0, 16), mediaById);
  const rawTarget = await mediaBuffer(target);
  const targetJpeg = await sharp(rawTarget, { failOn: "none" }).resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).flatten({ background: "#321126" }).jpeg({ quality: 78 }).toBuffer();
  const result = await askAnthropic(targetJpeg, sheet, cells.map(cell => `${cell.label}=${cell.name}`).join(", "));
  const cellByLabel = new Map(cells.map(cell => [cell.label, cell]));
  const rows = result.faces.map(face => {
    const reference = face.reference ? cellByLabel.get(face.reference) : undefined;
    return {
      project_id: projectId, media_asset_id: target.id, person_name: reference?.name ?? "",
      x: face.x, y: face.y, width: Math.min(face.width, 1 - face.x), height: Math.min(face.height, 1 - face.y),
      status: reference && face.confidence >= AUTO_CONFIRM_THRESHOLD ? "confirmed" : "suggested",
      source: "ai", confidence: face.confidence, reference_tag_id: reference?.tagId ?? null
    };
  }).filter(row => row.width > .01 && row.height > .01);
  if (rows.length) {
    const { error: insertError } = await supabase.from("photo_face_tags").insert(rows);
    if (insertError) throw insertError;
  } else {
    await supabase.from("photo_face_tags").insert({ project_id: projectId, media_asset_id: target.id, person_name: "", x: 0, y: 0, width: .01, height: .01, status: "rejected", source: "ai", confidence: 0 });
  }
  return { complete: false, mediaId: target.id, inserted: rows.length, confirmed: rows.filter(row => row.status === "confirmed").length, questions: rows.filter(row => row.status === "suggested").length };
}
