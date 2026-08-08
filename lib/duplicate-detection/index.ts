import { createHash } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTestContributor } from "@/lib/chapters";
import { readPrivateMedia } from "@/lib/photo-intelligence/media";

const CONTRIBUTOR_MAX_DISTANCE = 4;
const STUDIO_MAX_DISTANCE = 8;

type HashJob = {
  id: string;
  project_id: string;
  media_asset_id: string;
  attempts: number;
};

type MediaCandidate = {
  id: string;
  submission_id: string;
  sha256: string | null;
  dhash: string | null;
  canonical_media_id: string | null;
  created_at: string;
};

export function hammingDistance(left: string, right: string) {
  let bits = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  while (bits) {
    bits &= bits - BigInt(1);
    count += 1;
  }
  return count;
}

export function duplicateConfidence(distance: number) {
  if (distance === 0) return 0.9999;
  return Number(Math.max(0, 1 - distance / 64).toFixed(4));
}

function hashBands(hash: string) {
  return [0, 1, 2, 3].map(index => Number.parseInt(hash.slice(index * 4, index * 4 + 4), 16));
}

export function differenceHash(pixels: Uint8Array) {
  if (pixels.length !== 72) throw new Error("dHash requires exactly 9 x 8 grayscale pixels.");
  let value = BigInt(0);
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      value <<= BigInt(1);
      const offset = row * 9 + column;
      if (pixels[offset] > pixels[offset + 1]) value |= BigInt(1);
    }
  }
  return value.toString(16).padStart(16, "0");
}

async function hashImage(original: Buffer) {
  const sha256 = createHash("sha256").update(original).digest("hex");
  const image = sharp(original, { failOn: "none" }).rotate();
  const metadata = await image.metadata();
  const pixels = await image
    .clone()
    .resize(9, 8, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  const dhash = differenceHash(pixels);
  return {
    sha256,
    dhash,
    bands: hashBands(dhash),
    width: metadata.width ?? null,
    height: metadata.height ?? null
  };
}

function olderThanSource(candidate: MediaCandidate, source: MediaCandidate) {
  const candidateKey = `${candidate.created_at}:${candidate.id}`;
  const sourceKey = `${source.created_at}:${source.id}`;
  return candidateKey < sourceKey;
}

async function excludeTestCandidates(candidates: MediaCandidate[]) {
  if (!candidates.length) return [];
  const supabase = createAdminClient();
  const ids = [...new Set(candidates.map(item => item.submission_id))];
  const { data } = await supabase.from("submissions").select("id,name").in("id", ids);
  const genuine = new Set((data ?? []).filter(item => !isTestContributor(item.name)).map(item => item.id));
  return candidates.filter(item => genuine.has(item.submission_id));
}

async function recordMatch(input: {
  projectId: string;
  sourceId: string;
  candidateId: string;
  kind: "exact" | "near";
  distance: number;
  confidence: number;
  contributorVisible: boolean;
  studioStatus?: "open" | "merged";
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("media_duplicate_matches").upsert({
    project_id: input.projectId,
    source_media_id: input.sourceId,
    candidate_media_id: input.candidateId,
    match_kind: input.kind,
    hamming_distance: input.distance,
    confidence: input.confidence,
    contributor_visible: input.contributorVisible,
    studio_status: input.studioStatus ?? "open"
  }, { onConflict: "source_media_id,candidate_media_id", ignoreDuplicates: true });
  if (error) throw error;
}

async function completeHashJob(job: HashJob) {
  const supabase = createAdminClient();
  const { data: media, error: mediaError } = await supabase
    .from("media_assets")
    .select("id,submission_id,storage_path,mime_type,created_at")
    .eq("id", job.media_asset_id)
    .single();
  if (mediaError || !media) throw new Error("Queued media no longer exists.");

  if (!String(media.mime_type).startsWith("image/")) {
    await supabase.from("media_hash_jobs").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", job.id);
    await supabase.from("media_assets").update({ hash_status: "skipped" }).eq("id", media.id);
    return { mediaId: media.id, status: "skipped" as const };
  }

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("project_id,name")
    .eq("id", media.submission_id)
    .single();
  if (submissionError || !submission) throw new Error("Submission context no longer exists.");

  const original = await readPrivateMedia(supabase, media.storage_path);
  const result = await hashImage(original);
  const source: MediaCandidate = {
    id: media.id,
    submission_id: media.submission_id,
    sha256: result.sha256,
    dhash: result.dhash,
    canonical_media_id: null,
    created_at: media.created_at
  };

  const { error: hashUpdateError } = await supabase.from("media_assets").update({
    sha256: result.sha256,
    dhash: result.dhash,
    dhash_band_0: result.bands[0],
    dhash_band_1: result.bands[1],
    dhash_band_2: result.bands[2],
    dhash_band_3: result.bands[3],
    image_width: result.width,
    image_height: result.height,
    hash_status: "completed",
    hash_error: null
  }).eq("id", media.id);
  if (hashUpdateError) throw hashUpdateError;

  const { data: exactRows, error: exactError } = await supabase
    .from("media_assets")
    .select("id,submission_id,sha256,dhash,canonical_media_id,created_at")
    .eq("sha256", result.sha256)
    .neq("id", media.id)
    .order("created_at")
    .limit(50);
  if (exactError) throw exactError;
  const exactCandidates = (await excludeTestCandidates((exactRows ?? []) as MediaCandidate[]))
    .filter(candidate => olderThanSource(candidate, source));
  const exact = exactCandidates[0];

  if (exact) {
    const canonicalId = exact.canonical_media_id ?? exact.id;
    await recordMatch({
      projectId: submission.project_id,
      sourceId: media.id,
      candidateId: exact.id,
      kind: "exact",
      distance: 0,
      confidence: 1,
      contributorVisible: false,
      studioStatus: "merged"
    });
    const { error: canonicalError } = await supabase
      .from("media_assets")
      .update({ canonical_media_id: canonicalId })
      .eq("id", media.id);
    if (canonicalError) throw canonicalError;
  }

  const bandFilter = result.bands.map((band, index) => `dhash_band_${index}.eq.${band}`).join(",");
  const { data: nearRows, error: nearError } = await supabase
    .from("media_assets")
    .select("id,submission_id,sha256,dhash,canonical_media_id,created_at")
    .or(bandFilter)
    .neq("id", media.id)
    .not("dhash", "is", null)
    .limit(250);
  if (nearError) throw nearError;

  const nearCandidates = (await excludeTestCandidates((nearRows ?? []) as MediaCandidate[]))
    .filter(candidate => candidate.dhash && candidate.sha256 !== result.sha256 && olderThanSource(candidate, source))
    .map(candidate => ({ candidate, distance: hammingDistance(result.dhash, candidate.dhash as string) }))
    .filter(item => item.distance <= STUDIO_MAX_DISTANCE)
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 5);

  for (const match of nearCandidates) {
    await recordMatch({
      projectId: submission.project_id,
      sourceId: media.id,
      candidateId: match.candidate.id,
      kind: "near",
      distance: match.distance,
      confidence: duplicateConfidence(match.distance),
      contributorVisible: match.distance <= CONTRIBUTOR_MAX_DISTANCE
    });
  }

  await supabase.from("media_hash_jobs").update({
    status: "completed",
    last_error: null,
    updated_at: new Date().toISOString()
  }).eq("id", job.id);
  return {
    mediaId: media.id,
    status: "completed" as const,
    exact: Boolean(exact),
    near: nearCandidates.length
  };
}

async function failHashJob(job: HashJob, error: unknown) {
  const supabase = createAdminClient();
  const message = error instanceof Error ? error.message.slice(0, 1000) : "Unknown hashing error";
  const terminal = job.attempts >= 3;
  const nextAttemptAt = new Date(Date.now() + Math.min(60, 2 ** Math.max(0, job.attempts - 1)) * 60_000).toISOString();
  await supabase.from("media_assets").update({
    hash_status: terminal ? "failed" : "queued",
    hash_error: message
  }).eq("id", job.media_asset_id);
  await supabase.from("media_hash_jobs").update({
    status: terminal ? "failed" : "queued",
    last_error: message,
    next_attempt_at: nextAttemptAt,
    updated_at: new Date().toISOString()
  }).eq("id", job.id);
  return { mediaId: job.media_asset_id, status: terminal ? "failed" as const : "queued" as const, error: message };
}

export async function enqueueSubmissionHashing(submissionId: string) {
  const supabase = createAdminClient();
  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("id,project_id")
    .eq("id", submissionId)
    .single();
  if (submissionError || !submission) return { available: false, queued: 0, error: submissionError?.message };

  const { data: images, error: imageError } = await supabase
    .from("media_assets")
    .select("id,hash_status")
    .eq("submission_id", submissionId)
    .like("mime_type", "image/%");
  if (imageError) return { available: false, queued: 0, error: imageError.message };
  const queueable = (images ?? []).filter(item => !["completed", "processing", "queued"].includes(item.hash_status || ""));
  if (!queueable.length) return { available: true, queued: 0 };
  const jobs = queueable.map(image => ({
    project_id: submission.project_id,
    media_asset_id: image.id,
    status: "queued",
    next_attempt_at: new Date().toISOString()
  }));
  const { error: jobError } = await supabase.from("media_hash_jobs").upsert(jobs, {
    onConflict: "media_asset_id",
    ignoreDuplicates: true
  });
  if (jobError) return { available: false, queued: 0, error: jobError.message };
  await supabase.from("media_assets").update({ hash_status: "queued", hash_error: null }).in("id", queueable.map(item => item.id));
  return { available: true, queued: queueable.length };
}

export async function prepareHashBackfill(limit = 1000) {
  const supabase = createAdminClient();
  const { data: projects, error: projectError } = await supabase.from("projects").select("id").eq("slug", "sandi50th").limit(1);
  const projectId = projects?.[0]?.id;
  if (projectError || !projectId) return { available: false, queued: 0, error: projectError?.message || "Project not found." };
  const { data: submissions, error: submissionError } = await supabase.from("submissions").select("id,name").eq("project_id", projectId);
  if (submissionError) return { available: false, queued: 0, error: submissionError.message };
  const submissionIds = (submissions ?? []).filter(item => !isTestContributor(item.name)).map(item => item.id);
  if (!submissionIds.length) return { available: true, queued: 0, projectId };
  const { data: images, error: imageError } = await supabase
    .from("media_assets")
    .select("id,hash_status")
    .in("submission_id", submissionIds)
    .like("mime_type", "image/%")
    .in("hash_status", ["unprocessed", "failed"])
    .order("created_at")
    .limit(Math.max(1, Math.min(limit, 5000)));
  if (imageError) return { available: false, queued: 0, projectId, error: imageError.message };
  const jobs = (images ?? []).map(image => ({ project_id: projectId, media_asset_id: image.id, status: "queued", next_attempt_at: new Date().toISOString() }));
  if (jobs.length) {
    const { error } = await supabase.from("media_hash_jobs").upsert(jobs, { onConflict: "media_asset_id", ignoreDuplicates: true });
    if (error) return { available: false, queued: 0, projectId, error: error.message };
    await supabase.from("media_assets").update({ hash_status: "queued", hash_error: null }).in("id", jobs.map(item => item.media_asset_id));
  }
  return { available: true, queued: jobs.length, projectId };
}

export async function processHashJobs(options: { limit?: number; projectId?: string; submissionId?: string } = {}) {
  const supabase = createAdminClient();
  const { data: claimed, error } = await supabase.rpc("claim_media_hash_jobs", {
    requested_limit: Math.max(1, Math.min(options.limit ?? 4, 20)),
    requested_project: options.projectId ?? null,
    requested_submission: options.submissionId ?? null
  });
  if (error) return { available: false, processed: [], error: error.message };
  const processed = [];
  for (const job of (claimed ?? []) as HashJob[]) {
    try {
      processed.push(await completeHashJob(job));
    } catch (jobError) {
      processed.push(await failHashJob(job, jobError));
    }
  }
  return { available: true, processed };
}

