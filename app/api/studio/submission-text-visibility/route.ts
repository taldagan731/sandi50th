import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAccess } from "@/lib/studio/auth";

const PLACEHOLDER = "Photographs or video shared for Sandi's birthday story.";
const MARKER = "text-only upload placeholder suppressed";

const schema = z.object({
  submissionIds: z.array(z.string().uuid()).min(1).max(100),
  suppressed: z.boolean()
});

export async function POST(request: Request) {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = schema.parse(await request.json());
    const { data: submissions, error } = await owner.supabase
      .from("submissions")
      .select("id,first_memory,prompt,reviewer_notes")
      .eq("project_id", owner.project.id)
      .in("id", body.submissionIds);
    if (error) throw error;

    const eligible = (submissions ?? []).filter(item => item.first_memory?.trim() === PLACEHOLDER);
    if (eligible.length !== body.submissionIds.length) {
      return NextResponse.json({ error: "One or more records are not upload-only placeholders." }, { status: 400 });
    }

    for (const item of eligible) {
      const notes = String(item.reviewer_notes ?? "");
      const nextNotes = body.suppressed
        ? [notes, MARKER].filter(Boolean).join("\n")
        : notes.split("\n").filter(line => line.trim() !== MARKER).join("\n");
      const { error: updateError } = await owner.supabase
        .from("submissions")
        .update({
          prompt: body.suppressed ? "OWNER_ARCHIVE" : null,
          reviewer_notes: nextNotes,
          reviewed_by: owner.user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq("project_id", owner.project.id)
        .eq("id", item.id);
      if (updateError) throw updateError;
    }

    return NextResponse.json({ ok: true, updated: eligible.length, mediaChanged: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Text visibility could not be changed." }, { status: 400 });
  }
}
