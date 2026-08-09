import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAccess } from "@/lib/studio/auth";

const schema = z.object({
  submissionId: z.string().uuid(),
  reviewStatus: z.enum(["included", "excluded"])
});

export async function POST(request: Request) {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = schema.parse(await request.json());
    const { data, error } = await owner.supabase
      .from("submissions")
      .update({
        review_status: body.reviewStatus,
        reviewed_by: owner.user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", body.submissionId)
      .eq("project_id", owner.project.id)
      .select("id")
      .single();

    if (error || !data) return NextResponse.json({ error: "Contribution not found." }, { status: 404 });

    const { error: mediaError } = await owner.supabase
      .from("media_assets")
      .update({
        review_status: body.reviewStatus,
        reviewed_at: new Date().toISOString()
      })
      .eq("submission_id", body.submissionId);
    if (mediaError) throw mediaError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Visibility could not be saved."
    }, { status: 400 });
  }
}
