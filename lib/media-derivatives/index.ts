import convertHeic from "heic-convert";
import sharp from "sharp";
import { put } from "@vercel/blob";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readPrivateMedia } from "@/lib/photo-intelligence/media";

export type DerivativeMedia = {
  id: string;
  submission_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  bytes: number;
  poster_path: string | null;
  chapter_number?: number | null;
};

export type DerivativeResult = {
  mediaId: string;
  originalName: string;
  status: "converted" | "placeholder" | "already_ready" | "skipped" | "failed";
  derivativePath?: string;
  derivativeBytes?: number;
  error?: string;
};

export function isHeicMedia(media: Pick<DerivativeMedia, "mime_type" | "original_name" | "storage_path">) {
  return /heic|heif/i.test(media.mime_type)
    || /\.(?:heic|heif)$/i.test(media.original_name)
    || /\.(?:heic|heif)(?:$|\?)/i.test(media.storage_path);
}

async function browserSafeJpeg(original: Buffer, heic: boolean) {
  const decoded = heic
    ? Buffer.from(await convertHeic({ buffer: original, format: "JPEG", quality: 0.94 }))
    : original;

  return sharp(decoded, { failOn: "none", limitInputPixels: 120_000_000 })
    .rotate()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#f5d9dd" })
    .jpeg({ quality: 88, progressive: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
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
  return sharp(svg).jpeg({ quality: 88, progressive: true }).toBuffer();
}

export async function createImageDerivative(
  supabase: SupabaseClient,
  media: DerivativeMedia,
  options: { force?: boolean } = {}
): Promise<DerivativeResult> {
  if (!String(media.mime_type).startsWith("image/") && !isHeicMedia(media)) {
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
    try {
      derivative = await browserSafeJpeg(original, isHeicMedia(media));
    } catch (error) {
      status = "placeholder";
      conversionError = error instanceof Error ? error.message : "The original image could not be decoded.";
      derivative = await preservedPhotoPlaceholder();
    }
    const derivativePath = `posters/${media.id}-web.jpg`;
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
      ...(conversionError ? { error: conversionError } : {})
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
    .select("id,submission_id,storage_path,original_name,mime_type,bytes,poster_path,chapter_number")
    .eq("submission_id", submissionId);
  if (error) throw error;
  const candidates = ((data ?? []) as DerivativeMedia[]).filter(isHeicMedia);
  const results: DerivativeResult[] = [];
  for (const media of candidates) results.push(await createImageDerivative(supabase, media));
  return results;
}
