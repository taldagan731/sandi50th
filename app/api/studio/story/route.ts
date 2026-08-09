import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAccess } from "@/lib/studio/auth";

const updateSchema = z.object({
  chapterNumber: z.number().int().min(1).max(8),
  draftText: z.string().max(20000),
  approvedText: z.string().max(20000).optional(),
  action: z.enum(["save", "approve"])
});

export async function GET() {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: chapters, error: chapterError } = await owner.supabase
    .from("story_chapters")
    .select("id,chapter_number,title,source_notes,draft_text,approved_text,status,updated_at")
    .eq("project_id", owner.project.id)
    .order("chapter_number");
  if (chapterError) {
    return NextResponse.json({
      error: "The story-studio migration has not been installed.",
      detail: chapterError.message
    }, { status: 503 });
  }

  const { data: assignments, error: assignmentError } = await owner.supabase
    .from("story_assignments")
    .select("id,submission_id,chapter_number,rationale,confidence,status")
    .eq("project_id", owner.project.id);
  if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 });

  return NextResponse.json({ chapters, assignments });
}

export async function POST(request: Request) {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = updateSchema.parse(await request.json());
    const update = body.action === "approve"
      ? {
          draft_text: body.draftText,
          approved_text: body.approvedText ?? body.draftText,
          status: "approved",
          updated_by: owner.user.id,
          updated_at: new Date().toISOString()
        }
      : {
          draft_text: body.draftText,
          status: "draft",
          updated_by: owner.user.id,
          updated_at: new Date().toISOString()
        };

    const { error } = await owner.supabase
      .from("story_chapters")
      .update(update)
      .eq("project_id", owner.project.id)
      .eq("chapter_number", body.chapterNumber);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Chapter could not be saved."
    }, { status: 400 });
  }
}
