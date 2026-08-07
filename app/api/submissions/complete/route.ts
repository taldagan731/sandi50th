import { head, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const fileSchema = z.object({
  pathname: z.string().min(1).max(900),
  url: z.string().url().max(1500),
  downloadUrl: z.string().url().max(1500),
  contentType: z.string().min(1).max(150),
  contentDisposition: z.string().max(500),
  originalName: z.string().min(1).max(300),
  bytes: z.number().int().positive()
});

const schema = z.object({
  submissionId: z.string().uuid(),
  files: z.array(fileSchema).max(20)
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const expectedPrefix = `incoming/${body.submissionId}/`;

    await head(`submissions/${body.submissionId}/draft.json`);

    const verifiedFiles = [];
    for (const file of body.files) {
      if (!file.pathname.startsWith(expectedPrefix)) {
        return NextResponse.json({ error: "An uploaded file did not belong to this contribution." }, { status: 400 });
      }
      const stored = await head(file.pathname);
      if (stored.size !== file.bytes) {
        return NextResponse.json({ error: `${file.originalName} did not finish uploading. Please try that file again.` }, { status: 409 });
      }
      verifiedFiles.push({
        ...file,
        storedBytes: stored.size,
        uploadedAt: stored.uploadedAt
      });
    }

    const completedAt = new Date().toISOString();
    await put(
      `submissions/${body.submissionId}/complete.json`,
      JSON.stringify({
        version: 1,
        submissionId: body.submissionId,
        status: "complete",
        completedAt,
        files: verifiedFiles
      }),
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json"
      }
    );

    return NextResponse.json({ ok: true, submissionId: body.submissionId, fileCount: verifiedFiles.length });
  } catch (error) {
    console.error("submission-complete", error);
    return NextResponse.json({
      error: "Your files may have arrived, but confirmation failed. Do not delete them from your phone; email uploads@sandi50th.com and we will verify them."
    }, { status: 500 });
  }
}
