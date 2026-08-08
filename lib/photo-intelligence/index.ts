import * as exifr from "exifr";
import sharp from "sharp";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPrivateMedia } from "@/lib/photo-intelligence/media";

const MODEL = process.env.ANTHROPIC_PHOTO_MODEL || "claude-sonnet-4-20250514";
const REVIEW_THRESHOLD = 0.67;

const confidenceSchema = z.number().min(0).max(1);
const analysisSchema = z.object({
  estimatedEra: z.object({
    value: z.enum(["infant", "child", "adolescent", "young adult", "adult", "recent"]),
    confidence: confidenceSchema
  }),
  decadeGuess: z.object({
    value: z.number().int().min(1900).max(2030).nullable(),
    confidence: confidenceSchema,
    evidence: z.array(z.string()).max(6)
  }),
  setting: z.object({
    value: z.enum(["home", "school", "outdoors", "travel", "celebration", "formal portrait", "workplace", "beach", "holiday", "other"]),
    confidence: confidenceSchema
  }),
  people: z.object({
    approximateCount: z.number().int().min(0).max(100),
    composition: z.enum(["portrait", "group", "candid", "unclear"]),
    confidence: confidenceSchema
  }),
  notableObjects: z.array(z.string()).max(12),
  occasionMarkers: z.array(z.string()).max(10),
  eventClues: z.array(z.string()).max(10),
  literaryDescription: z.object({
    value: z.string().min(1).max(320),
    confidence: confidenceSchema
  }),
  chapterAssignment: z.object({
    chapterNumber: z.number().int().min(1).max(8),
    confidence: confidenceSchema,
    rationale: z.string().min(1).max(500)
  })
});

type Job = { id: string; project_id: string; media_asset_id: string; attempts: number };
type ProcessOptions = { limit?: number; projectId?: string; submissionId?: string };

const CHAPTERS = [
  "Once Upon a Time",
  "Growing Up in Roslyn",
  "Finding Her Voice",
  "Building Something Bigger",
  "The Family She Chose",
  "Around the World",
  "The People Who Love Her",
  "Still Becoming"
];

function jsonFromModel(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  const candidate = fenced ?? (firstBrace >= 0 && lastBrace > firstBrace ? text.slice(firstBrace, lastBrace + 1) : text);
  return analysisSchema.parse(JSON.parse(candidate));
}

function dateFromExif(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function decadeSpan(decade: number | null) {
  if (!decade) return { start: null, end: null };
  const start = Math.floor(decade / 10) * 10;
  return { start, end: start + 9 };
}

function contributorChapter(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  const exact = CHAPTERS.findIndex(title => title.toLowerCase() === normalized);
  if (exact >= 0) return exact + 1;
  const numeric = normalized.match(/\b([1-8])\b/);
  return numeric ? Number(numeric[1]) : null;
}

async function requestAnthropic(derivative: Buffer, context: Record<string, unknown>) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.15,
      system: "You analyze private family photographs for a human-reviewed birthday archive. Be literal, restrained, and honest about uncertainty. Never identify a person, infer sensitive traits, or invent an event. Return only valid JSON.",
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: derivative.toString("base64") }
          },
          {
            type: "text",
            text: `Analyze this reduced, metadata-free derivative. Contributor metadata is authoritative and must win over visual inference.\n\nContributor context:\n${JSON.stringify(context)}\n\nReturn this exact JSON shape:\n{\n  "estimatedEra":{"value":"infant|child|adolescent|young adult|adult|recent","confidence":0.0},\n  "decadeGuess":{"value":1990,"confidence":0.0,"evidence":["visible, non-sensitive clues only"]},\n  "setting":{"value":"home|school|outdoors|travel|celebration|formal portrait|workplace|beach|holiday|other","confidence":0.0},\n  "people":{"approximateCount":1,"composition":"portrait|group|candid|unclear","confidence":0.0},\n  "notableObjects":[],\n  "occasionMarkers":[],\n  "eventClues":[],\n  "literaryDescription":{"value":"One factual sentence in the restrained, present-tense Still Becoming voice.","confidence":0.0},\n  "chapterAssignment":{"chapterNumber":1,"confidence":0.0,"rationale":"Brief evidence-based reason."}\n}\n\nThe eight chapters are: ${CHAPTERS.map((title, index) => `${index + 1}. ${title}`).join("; ")}. Use null for an unknown decade. Do not name anyone from appearance.`
          }
        ]
      }]
    })
  });
  if (!response.ok) {
    throw new Error(`Anthropic photo analysis failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
  const payload = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const text = payload.content?.find(item => item.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned no analysis text.");
  return jsonFromModel(text);
}

async function completeJob(job: Job) {
  const supabase = createAdminClient();
  const { data: media, error: mediaError } = await supabase
    .from("media_assets")
    .select("id,submission_id,storage_path,original_name,mime_type,chapter_number")
    .eq("id", job.media_asset_id)
    .single();
  if (mediaError || !media) throw new Error("Queued media no longer exists.");

  if (!String(media.mime_type).startsWith("image/")) {
    await supabase.from("photo_analysis_jobs").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", job.id);
    await supabase.from("media_assets").update({ analysis_status: "skipped", exif_status: "unavailable" }).eq("id", media.id);
    return { mediaId: media.id, status: "skipped" as const };
  }

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("id,name,relationship,approximate_year,location,people,life_chapter,prompt")
    .eq("id", media.submission_id)
    .single();
  if (submissionError || !submission) throw new Error("Submission context no longer exists.");

  const original = await readPrivateMedia(supabase, media.storage_path);
  let capturedAt: Date | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;
  let exifStatus: "completed" | "unavailable" | "failed" = "unavailable";
  try {
    const exif = await exifr.parse(original, { tiff: true, exif: true, gps: true }) as Record<string, unknown> | undefined;
    capturedAt = dateFromExif(exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.ModifyDate);
    latitude = typeof exif?.latitude === "number" ? exif.latitude : null;
    longitude = typeof exif?.longitude === "number" ? exif.longitude : null;
    exifStatus = exif && (capturedAt || latitude !== null || longitude !== null) ? "completed" : "unavailable";
  } catch {
    exifStatus = "failed";
  }

  if (!submission.approximate_year && capturedAt) {
    await supabase.from("submissions").update({ approximate_year: String(capturedAt.getUTCFullYear()) }).eq("id", submission.id);
  }

  let derivative: Buffer;
  try {
    derivative = await sharp(original, { failOn: "none" })
      .rotate()
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#161016" })
      .jpeg({ quality: 74, progressive: true })
      .toBuffer();
  } catch (error) {
    throw new Error(`A metadata-free JPEG derivative could not be made: ${error instanceof Error ? error.message : "unknown image format"}`);
  }

  const analysis = await requestAnthropic(derivative, {
    relationship: submission.relationship || null,
    approximateYear: submission.approximate_year || (capturedAt ? String(capturedAt.getUTCFullYear()) : null),
    location: submission.location || null,
    people: submission.people || [],
    lifeChapter: submission.life_chapter || null,
    prompt: submission.prompt || null
  });

  const contributorAssignedChapter = contributorChapter(submission.life_chapter);
  const chapterNumber = contributorAssignedChapter ?? analysis.chapterAssignment.chapterNumber;
  const chapterConfidence = contributorAssignedChapter ? 1 : analysis.chapterAssignment.confidence;
  const { start: aiStart, end: aiEnd } = decadeSpan(analysis.decadeGuess.value);
  const exifYear = capturedAt?.getUTCFullYear() ?? null;
  const hasLowConfidence = [
    analysis.estimatedEra.confidence,
    analysis.decadeGuess.confidence,
    analysis.setting.confidence,
    analysis.people.confidence,
    analysis.literaryDescription.confidence,
    chapterConfidence
  ].some(value => value < REVIEW_THRESHOLD);
  const status = hasLowConfidence ? "review_required" : "completed";
  const now = new Date().toISOString();
  const assignmentRationale = contributorAssignedChapter
    ? "Contributor-supplied chapter metadata takes precedence."
    : analysis.chapterAssignment.rationale;

  const { error: updateError } = await supabase.from("media_assets").update({
    exif_status: exifStatus,
    exif_captured_at: capturedAt?.toISOString() ?? null,
    exif_latitude: latitude,
    exif_longitude: longitude,
    analysis_status: status,
    analysis_model: MODEL,
    analysis_era: analysis.estimatedEra.value,
    analysis_decade: analysis.decadeGuess.value,
    analysis_setting: analysis.setting.value,
    analysis_people_count: analysis.people.approximateCount,
    analysis_composition: analysis.people.composition,
    analysis_description: analysis.literaryDescription.value,
    analysis_objects: analysis.notableObjects,
    analysis_occasion_markers: analysis.occasionMarkers,
    analysis_event_clues: analysis.eventClues,
    analysis_confidence: {
      era: analysis.estimatedEra.confidence,
      decade: analysis.decadeGuess.confidence,
      setting: analysis.setting.confidence,
      people: analysis.people.confidence,
      description: analysis.literaryDescription.confidence,
      chapter: chapterConfidence
    },
    analysis_raw: analysis,
    analysis_error: null,
    analysis_completed_at: now,
    inferred_year_start: exifYear ?? aiStart,
    inferred_year_end: exifYear ?? aiEnd,
    date_inference_source: exifYear ? "exif" : analysis.decadeGuess.value ? "visual-decade" : null,
    assignment_confidence: chapterConfidence,
    assignment_rationale: assignmentRationale,
    ...(media.chapter_number ? {} : { chapter_number: chapterNumber })
  }).eq("id", media.id);
  if (updateError) throw updateError;

  await supabase.from("story_assignments").delete().eq("media_asset_id", media.id).eq("status", "suggested");
  await supabase.from("story_assignments").insert({
    project_id: job.project_id,
    submission_id: media.submission_id,
    media_asset_id: media.id,
    chapter_number: chapterNumber,
    rationale: assignmentRationale,
    confidence: chapterConfidence,
    status: "suggested"
  });

  await supabase.from("photo_analysis_jobs").update({ status, last_error: null, updated_at: now }).eq("id", job.id);
  return { mediaId: media.id, status, analysis };
}

async function failJob(job: Job, error: unknown) {
  const supabase = createAdminClient();
  const message = error instanceof Error ? error.message.slice(0, 1000) : "Unknown photo-analysis error";
  const terminal = job.attempts >= 3;
  const nextAttempt = new Date(Date.now() + Math.min(60, 5 * 2 ** Math.max(0, job.attempts - 1)) * 60_000).toISOString();
  await supabase.from("media_assets").update({ analysis_status: terminal ? "failed" : "queued", analysis_error: message }).eq("id", job.media_asset_id);
  await supabase.from("photo_analysis_jobs").update({
    status: terminal ? "failed" : "queued",
    last_error: message,
    next_attempt_at: nextAttempt,
    updated_at: new Date().toISOString()
  }).eq("id", job.id);
  return { mediaId: job.media_asset_id, status: terminal ? "failed" as const : "queued" as const, error: message };
}

export async function enqueueSubmissionPhotos(submissionId: string) {
  const supabase = createAdminClient();
  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("id,project_id")
    .eq("id", submissionId)
    .single();
  if (submissionError || !submission) return { queued: 0, available: false };

  const { data: images, error: imageError } = await supabase
    .from("media_assets")
    .select("id,analysis_status")
    .eq("submission_id", submissionId)
    .like("mime_type", "image/%");
  if (imageError) return { queued: 0, available: false };
  if (!images?.length) return { queued: 0, available: true };

  const jobs = images.map((image, index) => ({
    project_id: submission.project_id,
    media_asset_id: image.id,
    status: "queued",
    pilot_rank: index < 10 ? index + 1 : null,
    next_attempt_at: new Date().toISOString()
  }));
  const { error: jobError } = await supabase.from("photo_analysis_jobs").upsert(jobs, { onConflict: "media_asset_id", ignoreDuplicates: true });
  if (jobError) return { queued: 0, available: false, error: jobError.message };
  await supabase.from("media_assets").update({ analysis_status: "queued" }).in("id", images.map(image => image.id)).eq("analysis_status", "unprocessed");
  return { queued: jobs.length, available: true };
}

export async function processPhotoAnalysisJobs(options: ProcessOptions = {}) {
  const supabase = createAdminClient();
  const { data: claimed, error } = await supabase.rpc("claim_photo_analysis_jobs", {
    requested_limit: Math.max(1, Math.min(options.limit ?? 1, 10)),
    requested_project: options.projectId ?? null,
    requested_submission: options.submissionId ?? null
  });
  if (error) return { available: false, processed: [], error: error.message };

  const processed = [];
  for (const job of (claimed ?? []) as Job[]) {
    try {
      processed.push(await completeJob(job));
    } catch (jobError) {
      processed.push(await failJob(job, jobError));
    }
  }
  return { available: true, processed };
}
