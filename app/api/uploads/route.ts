import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-m4a",
  "audio/webm",
  "audio/ogg",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed"
];

type TokenPayload = {
  submissionId: string;
  originalName: string;
  bytes: number;
  contentType: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const match = /^incoming\/([0-9a-f-]{36})\//i.exec(pathname);
        if (!match || !clientPayload) throw new Error("Invalid contribution upload path.");

        const payload = JSON.parse(clientPayload) as TokenPayload;
        if (
          payload.submissionId !== match[1] ||
          payload.bytes < 1 ||
          payload.bytes > MAX_FILE_BYTES ||
          !ALLOWED_CONTENT_TYPES.includes(payload.contentType)
        ) {
          throw new Error("Invalid contribution upload request.");
        }

        const supabase = createAdminClient();
        const { data: submission, error } = await supabase
          .from("submissions")
          .select("id")
          .eq("id", payload.submissionId)
          .single();
        if (error || !submission) throw error ?? new Error("Submission not found.");

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
          validUntil: Date.now() + 2 * 60 * 60 * 1000,
          tokenPayload: JSON.stringify(payload)
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) return;
        const payload = JSON.parse(tokenPayload) as TokenPayload;
        const supabase = createAdminClient();
        const { error } = await supabase.from("media_assets").upsert({
          submission_id: payload.submissionId,
          storage_path: blob.pathname,
          original_name: payload.originalName,
          mime_type: blob.contentType || payload.contentType,
          bytes: payload.bytes
        }, { onConflict: "storage_path" });
        if (error) throw error;
      }
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("blob-upload", error);
    return NextResponse.json({ error: "The secure upload could not start." }, { status: 400 });
  }
}
