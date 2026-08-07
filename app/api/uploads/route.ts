import { head, put } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-m4a",
  "application/pdf"
];

type TokenPayload = {
  submissionId: string;
  originalName: string;
  bytes: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    const jsonResponse = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const match = /^incoming\/([0-9a-f-]{36})\//i.exec(pathname);
        if (!match || !clientPayload) throw new Error("Invalid contribution upload path.");

        const payload = JSON.parse(clientPayload) as TokenPayload;
        if (payload.submissionId !== match[1] || payload.bytes < 1 || payload.bytes > MAX_FILE_BYTES) {
          throw new Error("Invalid contribution upload request.");
        }

        await head(`submissions/${payload.submissionId}/draft.json`);

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
        await put(
          `receipts/${payload.submissionId}/${crypto.randomUUID()}.json`,
          JSON.stringify({
            version: 1,
            submissionId: payload.submissionId,
            originalName: payload.originalName,
            expectedBytes: payload.bytes,
            receivedAt: new Date().toISOString(),
            blob
          }),
          {
            access: "private",
            addRandomSuffix: false,
            contentType: "application/json"
          }
        );
      }
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("blob-upload", error);
    return NextResponse.json({ error: "The secure upload could not start." }, { status: 400 });
  }
}
