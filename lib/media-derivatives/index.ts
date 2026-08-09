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
  status: "converted" | "already_ready" | "skipped" | "failed";
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

  try {
    const original = await readPrivateMedia(supabase, media.storage_path);
    const derivative = await browserSafeJpeg(original, isHeicMedia(media));
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
      status: "converted",
      derivativePath,
      derivativeBytes: derivative.length
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
