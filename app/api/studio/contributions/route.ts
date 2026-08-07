import { NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";

export async function GET() {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: submissions, error: submissionError } = await owner.supabase
    .from("submissions")
    .select("id,name,contact,relationship,first_memory,story,approximate_year,location,people,life_chapter,prompt,consent,status,reviewer_notes,created_at,upload_completed_at")
    .eq("project_id", owner.project.id)
    .order("created_at", { ascending: false });
  if (submissionError) {
    return NextResponse.json({ error: submissionError.message }, { status: 500 });
  }

  const ids = submissions?.map(item => item.id) ?? [];
  const { data: media, error: mediaError } = ids.length
    ? await owner.supabase
        .from("media_assets")
        .select("id,submission_id,storage_path,original_name,mime_type,bytes,review_status,chapter_number,caption,reviewer_notes,poster_path,display_order,reviewed_at,created_at")
        .in("submission_id", ids)
        .order("display_order", { ascending: true })
    : { data: [], error: null };
  if (mediaError) {
    return NextResponse.json({
      error: "The studio migration has not been installed yet.",
      detail: mediaError.message
    }, { status: 503 });
  }

  const mediaBySubmission = new Map<string, typeof media>();
  for (const item of media ?? []) {
    const current = mediaBySubmission.get(item.submission_id) ?? [];
    current.push(item);
    mediaBySubmission.set(item.submission_id, current);
  }

  return NextResponse.json({
    submissions: (submissions ?? []).map(item => ({
      ...item,
      media: mediaBySubmission.get(item.id) ?? []
    }))
  });
}
