import { after, NextResponse } from "next/server";
import { z } from "zod";
import { finalizeSubmissionUpload, type FinalizeUploadFile } from "@/lib/submissions/finalize";

export const runtime = "nodejs";
export const maxDuration = 300;

const fileSchema = z.object({
  pathname: z.string().min(1).max(900),
  url: z.string().url().max(1500),
  downloadUrl: z.string().url().max(1500),
  contentType: z.string().min(1).max(150),
  contentDisposition: z.string().max(500),
  originalName: z.string().min(1).max(500),
  bytes: z.number().int().positive()
});

const schema = z.object({
  submissionId: z.string().uuid(),
  files: z.array(fileSchema).max(1000)
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await finalizeSubmissionUpload({
      submissionId: body.submissionId,
      files: body.files as FinalizeUploadFile[],
      sendArrivalAlert: true
    });

    after(async () => {
      // The shared finalizer already handles photo analysis and alert side-effects.
      // This hook remains so the route keeps its Node runtime after refactoring.
      await Promise.resolve();
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("submission-complete", error);
    const message = error instanceof Error && /did not finish uploading/i.test(error.message)
      ? error.message
      : "Your files may have arrived, but confirmation failed. Do not delete them from your phone; email uploads@sandi50th.com and we will verify them.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
