import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAccess } from "@/lib/studio/auth";

const schema = z.object({
  submissionId: z.string().uuid(),
  contributorName: z.string().trim().min(1).max(200)
});

export async function POST(request: Request) {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = schema.parse(await request.json());
    const { data, error } = await owner.supabase
      .from("submissions")
      .update({
        name: body.contributorName,
        reviewed_by: owner.user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", body.submissionId)
      .eq("project_id", owner.project.id)
      .select("id,name,first_memory,created_at")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Contribution not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, contribution: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "A valid contribution and contributor name are required." }, { status: 400 });
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The attribution could not be saved."
    }, { status: 400 });
  }
}
