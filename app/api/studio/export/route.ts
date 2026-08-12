import { NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";

export async function GET() {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: submissions, error: submissionError } = await owner.supabase
    .from("submissions")
    .select("*")
    .eq("project_id", owner.project.id)
    .order("created_at");
  if (submissionError) return NextResponse.json({ error: submissionError.message }, { status: 500 });

  const ids = submissions?.map(item => item.id) ?? [];
  const { data: media, error: mediaError } = ids.length
    ? await owner.supabase.from("media_assets").select("*").in("submission_id", ids).order("created_at")
    : { data: [], error: null };
  if (mediaError) return NextResponse.json({ error: mediaError.message }, { status: 500 });

  const { data: chapters } = await owner.supabase
    .from("story_chapters")
    .select("*")
    .eq("project_id", owner.project.id)
    .order("chapter_number");

  const payload = {
    exportedAt: new Date().toISOString(),
    project: owner.project,
    submissions: submissions ?? [],
    media: media ?? [],
    chapters: chapters ?? []
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sandi50th-archive-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store"
    }
  });
}
