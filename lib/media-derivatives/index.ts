import { createHash } from "node:crypto";
import convertHeic from "heic-convert";
import sharp from "sharp";
import { put } from "@vercel/blob";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readPrivateMedia } from "@/lib/photo-intelligence/media";
import { detectOriginalOrientation, manualRotationFromNotes, type ExifOrientation } from "@/lib/media-orientation";

export type DerivativeMedia = {
  id: string;
  submission_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  bytes: number;
  poster_path: string | null;
  chapter_number?: number | null;
  reviewer_notes?: string | null;
};

export type DerivativeResult = {
  mediaId: string;
  originalName: string;
  status: "converted" | "placeholder" | "already_ready" | "skipped" | "failed";
  derivativePath?: string;
  derivativeBytes?: number;
  error?: string;
  originalOrientation?: ExifOrientation;
  manualRotation?: number;
};

export function isHeicMedia(media: Pick<DerivativeMedia, "mime_type" | "original_name" | "storage_path">) {
  return /heic|heif/i.test(media.mime_type)
    || /\.(?:heic|heif)$/i.test(media.original_name)
    || /\.(?:heic|heif)(?:$|\?)/i.test(media.storage_path);
}


export function isImageMedia(media: Pick<DerivativeMedia, "mime_type" | "original_name" | "storage_path">) {
  return String(media.mime_type).startsWith("image/") || isHeicMedia(media);
}

async function explicitlyOrientDecoded(decoded: Buffer, orientation: ExifOrientation) {
  const angle = orientation === 6 || orientation === 5
    ? 90
    : orientation === 3 || orientation === 4
      ? 180
      : orientation === 8 || orientation === 7
        ? 270
        : 0;
  const flop = orientation === 2 || orientation === 4 || orientation === 5 || orientation === 7;
  if (!flop) return sharp(decoded, { failOn: "none", limitInputPixels: 120_000_000 }).rotate(angle);
  if (angle === 0) return sharp(decoded, { failOn: "none", limitInputPixels: 120_000_000 }).flop();
  if (angle === 180) return sharp(decoded, { failOn: "none", limitInputPixels: 120_000_000 }).flip();
  const rotated = await sharp(decoded, { failOn: "none", limitInputPixels: 120_000_000 })
    .rotate(angle)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return sharp(rotated.data, {
    raw: { width: rotated.info.width, height: rotated.info.height, channels: rotated.info.channels }
  }).flop();
}
async function browserSafeJpeg(original: Buffer, heic: boolean, manualRotation: number) {
  const originalOrientation = await detectOriginalOrientation(original);
  const decoded = heic
    ? Buffer.from(await convertHeic({ buffer: original, format: "JPEG", quality: 0.94 }))
    : original;

  const orientedPipeline = heic
    ? await explicitlyOrientDecoded(decoded, originalOrientation)
    : sharp(decoded, { failOn: "none", limitInputPixels: 120_000_000 }).autoOrient();
  // Sharp applies only one rotation operation per pipeline. Materialize the
  // EXIF-corrected pixels first, then apply the owner's cumulative quarter-turn.
  const oriented = await orientedPipeline.raw().toBuffer({ resolveWithObject: true });
  const derivative = await sharp(oriented.data, {
    raw: { width: oriented.info.width, height: oriented.info.height, channels: oriented.info.channels }
  })
    .rotate(manualRotation)
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#f5d9dd" })
    .withMetadata({ orientation: 1 })
    .jpeg({ quality: 88, progressive: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
  return { derivative, originalOrientation };
}

async function preservedPhotoPlaceholder() {
  const svg = Buffer.from(`
    <svg width="1600" height="1200" viewBox="0 0 1600 1200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7b235d"/>
          <stop offset="0.5" stop-color="#d94d7d"/>
          <stop offset="1" stop-color="#ff9a76"/>
        </linearGradient>
        <radialGradient id="light" cx="70%" cy="24%" r="62%">
          <stop offset="0" stop-color="#ffe5ad" stop-opacity="0.92"/>
          <stop offset="1" stop-color="#ffe5ad" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1600" height="1200" fill="url(#ground)"/>
      <rect width="1600" height="1200" fill="url(#light)"/>
      <circle cx="800" cy="520" r="150" fill="none" stroke="#fff4df" stroke-width="18" opacity="0.88"/>
      <path d="M585 785l150-170 105 105 95-92 180 157z" fill="#fff4df" opacity="0.88"/>
      <text x="800" y="930" text-anchor="middle" fill="#fff4df" font-family="Arial, sans-serif" font-size="56" font-weight="700">Photograph safely preserved</text>
    </svg>`);
  return sharp(svg).withMetadata({ orientation: 1 }).jpeg({ quality: 88, progressive: true }).toBuffer();
}

export async function createImageDerivative(
  supabase: SupabaseClient,
  media: DerivativeMedia,
  options: { force?: boolean } = {}
): Promise<DerivativeResult> {
  if (!isImageMedia(media)) {
    return { mediaId: media.id, originalName: media.original_name, status: "skipped" };
  }
  if (media.poster_path && !options.force) {
    return { mediaId: media.id, originalName: media.original_name, status: "already_ready", derivativePath: media.poster_path };
  }

  let original: Buffer;
  try {
    original = await readPrivateMedia(supabase, media.storage_path);
  } catch (error) {
    return {
      mediaId: media.id,
      originalName: media.original_name,
      status: "failed",
      error: error instanceof Error ? error.message : "The original could not be read."
    };
  }

  try {
    let status: DerivativeResult["status"] = "converted";
    let conversionError: string | undefined;
    let derivative: Buffer;
    let originalOrientation: ExifOrientation = 1;
    const manualRotation = manualRotationFromNotes(media.reviewer_notes);
    try {
      const prepared = await browserSafeJpeg(original, isHeicMedia(media), manualRotation);
      derivative = prepared.derivative;
      originalOrientation = prepared.originalOrientation;
    } catch (error) {
      status = "placeholder";
      conversionError = error instanceof Error ? error.message : "The original image could not be decoded.";
      derivative = await preservedPhotoPlaceholder();
    }
    const derivativeHash = createHash("sha256").update(derivative).digest("hex").slice(0, 16);
    const derivativePath = `posters/${media.id}-web-${derivativeHash}.jpg`;
    await put(derivativePath, derivative, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/jpeg"
    });
    const { error } = await supabase.from("media_assets").update({ poster_path: derivativePath }).eq("id", media.id);
    if (error) throw error;
    return {
      mediaId: media.id,
      originalName: media.original_name,
      status,
      derivativePath,
      derivativeBytes: derivative.length,
      ...(conversionError ? { error: conversionError } : {}),
      originalOrientation,
      manualRotation,
    };
  } catch (error) {
    return {
      mediaId: media.id,
      originalName: media.original_name,
      status: "failed",
      error: error instanceof Error ? error.message : "The presentation copy could not be prepared."
    };
  }
}

export async function processSubmissionImageDerivatives(supabase: SupabaseClient, submissionId: string) {
  const { data, error } = await supabase
    .from("media_assets")
    .select("id,submission_id,storage_path,original_name,mime_type,bytes,poster_path,chapter_number,reviewer_notes")
    .eq("submission_id", submissionId);
  if (error) throw error;
  const candidates = ((data ?? []) as DerivativeMedia[]).filter(isImageMedia);
  const results: DerivativeResult[] = [];
  for (const media of candidates) results.push(await createImageDerivative(supabase, media));
  return results;
}
