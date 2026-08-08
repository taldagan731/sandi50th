import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioOwner } from "@/lib/studio/auth";

const schema = z.object({
  mediaId: z.string().uuid(),
  reviewStatus: z.enum(["included", "excluded"]),
  chapterNumber: z.number().int().min(1).max(8).nullable().optional(),
  caption: z.string().trim().max(1000).optional().default(""),
  notes: z.string().trim().max(3000).optional().default(""),
  displayOrder: z.number().int().min(0).max(10000).optional().default(0)
});

export async function POST(request: Request) {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = schema.parse(await request.json());
    const { data: media, error: mediaError } = await owner.supabase
      .from("media_assets")
      .select("id,submission_id,mime_type,poster_path")
      .eq("id", body.mediaId)
      .single();
    if (mediaError || !media) return NextResponse.json({ error: "Media not found." }, { status: 404 });

    const { data: submission } = await owner.supabase
      .from("submissions")
      .select("id,project_id")
      .eq("id", media.submission_id)
      .eq("project_id", owner.project.id)
      .single();
    if (!submission) return NextResponse.json({ error: "Media not found." }, { status: 404 });

    const { error: updateError } = await owner.supabase
      .from("media_assets")
      .update({
        review_status: body.reviewStatus,
        chapter_number: body.chapterNumber ?? null,
        caption: body.caption,
        reviewer_notes: body.notes,
        display_order: body.displayOrder,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", body.mediaId);
    if (updateError) throw updateError;

    const { data: included } = await owner.supabase
      .from("media_assets")
      .select("id")
      .eq("submission_id", media.submission_id)
      .neq("review_status", "excluded")
      .limit(1);

    await owner.supabase
      .from("submissions")
      .update({ status: included?.length ? "visible" : "excluded" })
      .eq("id", media.submission_id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Visibility could not be saved."
    }, { status: 400 });
  }
}
