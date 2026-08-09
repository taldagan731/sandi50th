import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAccess } from "@/lib/studio/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const resultSchema = z.object({
  assignments: z.array(z.object({
    submissionId: z.string().uuid(),
    chapterNumber: z.number().int().min(1).max(8),
    rationale: z.string().max(1000),
    confidence: z.number().min(0).max(1)
  })),
  chapters: z.array(z.object({
    chapterNumber: z.number().int().min(1).max(8),
    draftText: z.string().max(20000)
  }))
});

const chapterBriefs = [
  "1 — Once Upon a Time: birth, earliest photographs, first family stories.",
  "2 — Growing Up in Roslyn: childhood, school days, traditions, Beth.",
  "3 — Finding Her Voice: Boston University, English and psychology, England.",
  "4 — Building Something Bigger: advertising, Oracle, work, leadership.",
  "5 — The Family She Chose: love, partnership, Bram and Josephine.",
  "6 — Around the World: travel and memories carried home.",
  "7 — The People Who Love Her: family, friends, colleagues, generations.",
  "8 — Still Becoming: Sandi today, birthday wishes, unwritten future."
];

export async function POST() {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "ANTHROPIC_API_KEY is not configured. No draft was generated."
    }, { status: 503 });
  }

  const { data: submissions, error } = await owner.supabase
    .from("submissions")
    .select("id,name,relationship,first_memory,story,approximate_year,location,people,life_chapter,prompt,created_at")
    .eq("project_id", owner.project.id)
    .neq("review_status", "excluded")
    .not("name", "ilike", "%MOBILE TEST%")
    .not("name", "ilike", "%CODEX%")
    .order("created_at", { ascending: true })
    .limit(250);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sources = (submissions ?? []).map(item => ({
    id: item.id,
    contributor: item.name,
    relationship: item.relationship,
    firstMemory: item.first_memory,
    story: item.story,
    approximateYear: item.approximate_year,
    place: item.location,
    people: item.people,
    contributorChapterSuggestion: item.life_chapter,
    birthdayPrompt: item.prompt
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 12000,
      system: [
        "You are drafting a private birthday documentary called Still Becoming.",
        "Write with literary restraint: observant, specific, warm without generic sentimentality.",
        "Every factual detail must come from the supplied memories. Never invent dates, events, relationships, quotations, or motives.",
        "If sources conflict or are thin, preserve uncertainty or leave the passage spare.",
        "This is a draft for human approval. It must never imply it is final or publish itself.",
        "Return JSON only, with no markdown fences."
      ].join(" "),
      messages: [{
        role: "user",
        content: `Create an eight-chapter narrative draft and assign every submission to its strongest chapter.

Chapters:
${chapterBriefs.join("\n")}

Return exactly:
{"assignments":[{"submissionId":"uuid","chapterNumber":1,"rationale":"brief reason","confidence":0.8}],"chapters":[{"chapterNumber":1,"draftText":"draft prose"}]}

Use source identifiers only for assignments. Draft each chapter from its assigned evidence. Aim for 250–600 words per chapter when evidence supports it; shorter is better than invented connective tissue.

Sources:
${JSON.stringify(sources)}`
      }]
    })
  });

  const message = await response.json();
  if (!response.ok) {
    return NextResponse.json({
      error: message?.error?.message || "Anthropic drafting request failed."
    }, { status: 502 });
  }

  const text = message?.content?.find((block: { type: string; text?: string }) => block.type === "text")?.text;
  if (!text) return NextResponse.json({ error: "Anthropic returned no draft text." }, { status: 502 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\`\`\`(?:json)?/i, "").replace(/\`\`\`$/, "").trim());
  } catch {
    return NextResponse.json({ error: "The draft could not be parsed; nothing was saved." }, { status: 502 });
  }
  const result = resultSchema.parse(parsed);

  const sourceIds = new Set(sources.map(source => source.id));
  const assignments = result.assignments.filter(item => sourceIds.has(item.submissionId));

  const { error: clearError } = await owner.supabase
    .from("story_assignments")
    .delete()
    .eq("project_id", owner.project.id)
    .eq("status", "suggested");
  if (clearError) throw clearError;

  if (assignments.length) {
    const { error: assignmentError } = await owner.supabase
      .from("story_assignments")
      .insert(assignments.map(item => ({
        project_id: owner.project.id,
        submission_id: item.submissionId,
        media_asset_id: null,
        chapter_number: item.chapterNumber,
        rationale: item.rationale,
        confidence: item.confidence,
        status: "suggested"
      })));
    if (assignmentError) throw assignmentError;
  }

  for (const chapter of result.chapters) {
    const { error: chapterError } = await owner.supabase
      .from("story_chapters")
      .update({
        draft_text: chapter.draftText,
        status: "draft",
        updated_by: owner.user.id,
        updated_at: new Date().toISOString()
      })
      .eq("project_id", owner.project.id)
      .eq("chapter_number", chapter.chapterNumber);
    if (chapterError) throw chapterError;
  }

  return NextResponse.json({
    ok: true,
    assignmentCount: assignments.length,
    chapterCount: result.chapters.length
  });
}
