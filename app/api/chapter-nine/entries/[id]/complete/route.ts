import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAPTER_NINE_PROMPT, requireChapterNineSession } from "@/lib/chapter-nine";
import { finalizeSubmissionUpload, type FinalizeUploadFile } from "@/lib/submissions/finalize";

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
  files: z.array(fileSchema).max(1000).default([]),
  removedMediaIds: z.array(z.string().uuid()).max(200).default([])
});

async function assertEntry(projectId: string, id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("id")
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("prompt", CHAPTER_NINE_PROMPT)
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Entry not found.");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireChapterNineSession();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    await assertEntry(auth.projectId, id);
    const body = schema.parse(await request.json());

    if (body.removedMediaIds.length) {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from("media_assets")
        .update({ review_status: "excluded" })
        .eq("submission_id", id)
        .in("id", body.removedMediaIds);
      if (error) throw error;
    }

    const result = await finalizeSubmissionUpload({
      submissionId: id,
      files: body.files as FinalizeUploadFile[],
      sendArrivalAlert: false
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("chapter-nine-complete", error);
    return NextResponse.json({
      error: "The page appeared, but the backup confirmation did not finish. Please try again before closing the page."
    }, { status: 500 });
  }
}
