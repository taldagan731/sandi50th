import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultReviewStatus } from "@/lib/chapters";

export const runtime = "nodejs";

const schema = z.object({
  submissionId: z.string().uuid().optional(),
  contributorName: z.string().trim().max(120).optional().default(""),
  contentType: z.enum(["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-m4a", "audio/webm", "audio/ogg"]),
  bytes: z.number().int().positive().max(10 * 1024 * 1024)
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const supabase = createAdminClient();
    let submissionId = body.submissionId;
    let contributorName = body.contributorName;

    if (submissionId) {
      const { data, error } = await supabase.from("submissions").select("id,name").eq("id", submissionId).single();
      if (error || !data) return NextResponse.json({ error: "The original contribution could not be found." }, { status: 404 });
      contributorName = data.name;
    } else {
      if (!contributorName) return NextResponse.json({ error: "Add your name before recording it." }, { status: 400 });
      const { data: project, error: projectError } = await supabase.from("projects").select("id").eq("slug", "sandi50th").single();
      if (projectError || !project) throw projectError ?? new Error("Project not found.");
      const reviewStatus = defaultReviewStatus(contributorName);
      const { data, error } = await supabase.from("submissions").insert({
        project_id: project.id,
        name: contributorName,
        contact: "Name chorus return visit",
        relationship: "Someone who loves Sandi",
        first_memory: "Name chorus recording.",
        story: "",
        approximate_year: "2026",
        location: "",
        people: [],
        life_chapter: "Sandi today",
        prompt: "NAME_CHORUS",
        consent: true,
        review_status: reviewStatus,
        status: reviewStatus === "excluded" ? "excluded" : "received"
      }).select("id").single();
      if (error || !data) throw error ?? new Error("Could not create the chorus contribution.");
      submissionId = data.id;
    }

    const extension = body.contentType.includes("wav") ? "wav" : body.contentType.includes("mp4") || body.contentType.includes("m4a") ? "m4a" : body.contentType.includes("ogg") ? "ogg" : body.contentType.includes("mpeg") ? "mp3" : "webm";
    const originalName = `name-chorus-${crypto.randomUUID()}.${extension}`;
    return NextResponse.json({
      submissionId,
      originalName,
      pathname: `incoming/${submissionId}/${originalName}`,
      contributorName
    });
  } catch (error) {
    console.error("name-chorus-start", error);
    return NextResponse.json({ error: "The name recording could not be prepared. Your contribution is already safe." }, { status: 400 });
  }
}
