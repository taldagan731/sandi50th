import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioOwner } from "@/lib/studio/auth";

const schema = z.object({
  submissionId: z.string().uuid(),
  reviewStatus: z.enum(["pending", "included", "excluded"])
});

export async function POST(request: Request) {
  const owner = await requireStudioOwner();
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
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Decision could not be saved."
    }, { status: 400 });
  }
}
