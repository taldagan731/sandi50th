import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  submissionId: z.string().uuid(),
  files: z.array(z.object({
    path: z.string().min(1).max(800),
    name: z.string().min(1).max(300),
    type: z.string().min(1).max(150),
    size: z.number().int().positive()
  })).max(20)
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select("id")
      .eq("id", body.submissionId)
      .single();
    if (submissionError || !submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    if (body.files.length) {
      const { error: mediaError } = await supabase.from("media_assets").insert(
        body.files.map(file => ({
          submission_id: body.submissionId,
          storage_path: file.path,
          original_name: file.name,
          mime_type: file.type,
          bytes: file.size
        }))
      );
      if (mediaError) throw mediaError;
    }

    const { error: updateError } = await supabase
      .from("submissions")
      .update({ status: "uploaded", upload_completed_at: new Date().toISOString() })
      .eq("id", body.submissionId);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("submission-complete", error);
    return NextResponse.json({ error: "The upload arrived, but confirmation failed. Please contact uploads@sandi50th.com." }, { status: 500 });
  }
}
