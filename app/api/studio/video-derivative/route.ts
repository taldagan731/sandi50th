import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudioAccess } from "@/lib/studio/auth";

export const runtime = "nodejs";

const MAX_DERIVATIVE_BYTES = 500 * 1024 * 1024;

type DerivativePayload = {
  mediaId: string;
  submissionId: string;
  bytes: number;
  keyword: string;
};

function derivativePath(submissionId: string, mediaId: string) {
  return `incoming/${submissionId}/web/${mediaId}-web.mp4`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const owner = await requireStudioAccess();
        if (!owner || !clientPayload) throw new Error("Unauthorized");
        const payload = JSON.parse(clientPayload) as DerivativePayload;
        if (
          payload.keyword !== "Purple50" ||
          !/^[0-9a-f-]{36}$/i.test(payload.mediaId) ||
          !/^[0-9a-f-]{36}$/i.test(payload.submissionId) ||
          payload.bytes < 1 ||
          payload.bytes > MAX_DERIVATIVE_BYTES ||
          pathname !== derivativePath(payload.submissionId, payload.mediaId)
        ) throw new Error("Invalid derivative request");

        const { data: media } = await owner.supabase
          .from("media_assets")
          .select("id,submission_id,mime_type")
          .eq("id", payload.mediaId)
          .eq("submission_id", payload.submissionId)
          .single();
        if (!media || !media.mime_type.startsWith("video/")) throw new Error("Video not found");
        const { data: submission } = await owner.supabase
          .from("submissions")
          .select("id")
          .eq("id", payload.submissionId)
          .eq("project_id", owner.project.id)
          .single();
        if (!submission) throw new Error("Video not found");

        return {
          allowedContentTypes: ["video/mp4"],
          maximumSizeInBytes: MAX_DERIVATIVE_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
          validUntil: Date.now() + 30 * 60 * 1000,
          tokenPayload: JSON.stringify(payload)
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) return;
        const payload = JSON.parse(tokenPayload) as DerivativePayload;
        const supabase = createAdminClient();
        const { data: media, error: mediaError } = await supabase
          .from("media_assets")
          .select("id,submission_id,storage_path,original_name,reviewer_notes")
          .eq("id", payload.mediaId)
          .eq("submission_id", payload.submissionId)
          .single();
        if (mediaError || !media) throw mediaError ?? new Error("Video not found");

        const originalNote = `Original preserved at ${media.storage_path} as ${media.original_name}.`;
        const notes = String(media.reviewer_notes || "");
        const reviewerNotes = notes.includes(originalNote) ? notes : [notes, originalNote].filter(Boolean).join("\n");
        const webName = media.original_name.replace(/\.[^.]+$/, "") + ".mp4";
        const { error } = await supabase.from("media_assets").update({
          storage_path: blob.pathname,
          original_name: webName,
          mime_type: "video/mp4",
          bytes: payload.bytes,
          reviewer_notes: reviewerNotes
        }).eq("id", media.id);
        if (error) throw error;
      }
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("studio-video-derivative", error);
    return NextResponse.json({ error: "The web video derivative could not be installed." }, { status: 400 });
  }
}