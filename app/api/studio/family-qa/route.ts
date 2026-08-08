import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioOwner } from "@/lib/studio/auth";
import {
  FAMILY_CHORUSES,
  FAMILY_QA_PENDING,
  FAMILY_QA_SEED,
  chapterLabel,
  decodeFamilyQaMetadata,
  encodeFamilyQaMetadata,
  type FamilyQaAnswer
} from "@/lib/family-qa";

const answerSchema = z.object({
  id: z.string().uuid().optional(),
  contributorName: z.string().trim().min(1).max(120),
  relationship: z.string().trim().min(1).max(120),
  question: z.string().trim().min(1).max(1000),
  answer: z.string().trim().min(1).max(10000),
  chapterNumber: z.number().int().min(1).max(8),
  when: z.string().trim().max(160).default(""),
  place: z.string().trim().max(250).default(""),
  chorusKeys: z.array(z.string().trim().min(1).max(100)).max(3).default([]),
  photoAssetIds: z.array(z.string().uuid()).max(8).default([]),
  photoRefs: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  showInChapter: z.boolean().default(true),
  editorialNote: z.string().trim().max(2000).optional().default(""),
  visible: z.boolean().default(true)
});

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("seed") }),
  z.object({ action: z.literal("create"), answer: answerSchema.omit({ id: true }) }),
  z.object({ action: z.literal("update"), answer: answerSchema.required({ id: true }) }),
  z.object({ action: z.literal("bulk"), text: z.string().min(1).max(200000) })
]);

const columns = "id,name,relationship,first_memory,approximate_year,location,life_chapter,prompt,review_status,reviewer_notes,created_at";

function rowToAnswer(row: Record<string, unknown>) {
  const metadata = decodeFamilyQaMetadata(String(row.reviewer_notes ?? ""));
  const chapterMatch = String(row.life_chapter ?? "").match(/\b([1-8])\b/);
  return {
    id: String(row.id),
    sourceId: metadata?.sourceId ?? String(row.id),
    contributorName: String(row.name ?? ""),
    relationship: String(row.relationship ?? ""),
    question: String(row.prompt ?? ""),
    answer: String(row.first_memory ?? ""),
    chapterNumber: chapterMatch ? Number(chapterMatch[1]) : 8,
    when: String(row.approximate_year ?? ""),
    place: String(row.location ?? ""),
    chorusKeys: metadata?.chorusKeys ?? [],
    photoAssetIds: metadata?.photoAssetIds ?? [],
    photoRefs: metadata?.photoRefs ?? [],
    showInChapter: metadata?.showInChapter !== false,
    editorialNote: metadata?.editorialNote ?? "",
    visible: row.review_status !== "excluded",
    createdAt: String(row.created_at ?? "")
  };
}

function rowForAnswer(projectId: string, answer: FamilyQaAnswer, visible = true) {
  return {
    project_id: projectId,
    name: answer.contributorName,
    contact: null,
    relationship: answer.relationship,
    first_memory: answer.answer,
    story: "",
    approximate_year: answer.when,
    location: answer.place,
    people: [],
    life_chapter: chapterLabel(answer.chapterNumber),
    prompt: answer.question,
    consent: true,
    status: "family_qa",
    review_status: visible ? "included" : "excluded",
    reviewer_notes: encodeFamilyQaMetadata(answer),
    upload_completed_at: new Date().toISOString()
  };
}

const blockLabels = [
  "CONTRIBUTOR",
  "RELATIONSHIP",
  "QUESTION",
  "ANSWER",
  "WHEN",
  "CHAPTER",
  "CHORUS",
  "CHORUS ORDER",
  "PLACE",
  "PHOTOS",
  "EDITOR NOTE"
];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}

function field(block: string, label: string) {
  const alternatives = blockLabels.filter(item => item !== label).map(escapeRegex).join("|");
  const escaped = escapeRegex(label);
  const match = block.match(new RegExp(`(?:^|\\n)\\s*${escaped}:\\s*([\\s\\S]*?)(?=\\n\\s*(?:${alternatives}):|$)`, "i"));
  return match?.[1]?.trim() ?? "";
}

function chorusKeysFromText(value: string) {
  const normalized = value.toLowerCase();
  return FAMILY_CHORUSES
    .filter(item => normalized.includes(item.key) || normalized.includes(item.question.toLowerCase()))
    .map(item => item.key);
}

function parseBulk(text: string) {
  const blocks = text.split(/^\s*---\s*$/m).map(item => item.trim()).filter(Boolean);
  return blocks.map((block, index) => {
    const contributorName = field(block, "CONTRIBUTOR");
    const relationship = field(block, "RELATIONSHIP");
    const question = field(block, "QUESTION");
    const answer = field(block, "ANSWER");
    if (!contributorName || !relationship || !question || !answer) {
      throw new Error(`Block ${index + 1} needs CONTRIBUTOR, RELATIONSHIP, QUESTION, and ANSWER.`);
    }
    const chapterValue = field(block, "CHAPTER");
    const chapterMatch = chapterValue.match(/\b([1-8])\b/);
    const photoRefs = field(block, "PHOTOS")
      .split(/\r?\n/)
      .map(item => item.replace(/^\s*[-*]\s*/, "").trim())
      .filter(Boolean);
    return {
      id: `manual-${crypto.randomUUID()}`,
      contributorName,
      relationship,
      question,
      answer,
      chapterNumber: chapterMatch ? Number(chapterMatch[1]) : 8,
      when: field(block, "WHEN"),
      place: field(block, "PLACE"),
      chorusKeys: chorusKeysFromText(field(block, "CHORUS")),
      photoAssetIds: [],
      photoRefs,
      showInChapter: true,
      editorialNote: field(block, "EDITOR NOTE")
    } satisfies FamilyQaAnswer;
  });
}

async function currentAnswers(owner: NonNullable<Awaited<ReturnType<typeof requireStudioOwner>>>) {
  const result = await owner.supabase
    .from("submissions")
    .select(columns)
    .eq("project_id", owner.project.id)
    .eq("status", "family_qa")
    .order("created_at", { ascending: true });
  if (result.error) throw result.error;
  return (result.data ?? []).map(item => rowToAnswer(item as unknown as Record<string, unknown>));
}

export async function GET() {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({
      answers: await currentAnswers(owner),
      choruses: FAMILY_CHORUSES,
      pending: FAMILY_QA_PENDING,
      suppliedCount: FAMILY_QA_SEED.length
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Family Q&A could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = requestSchema.parse(await request.json());

    if (body.action === "seed") {
      const existing = await currentAnswers(owner);
      const existingSourceIds = new Set(existing.map(item => item.sourceId));
      const missing = FAMILY_QA_SEED.filter(item => !existingSourceIds.has(item.id));
      if (missing.length) {
        const result = await owner.supabase
          .from("submissions")
          .insert(missing.map(item => rowForAnswer(owner.project.id, item)));
        if (result.error) throw result.error;
      }
      return NextResponse.json({ added: missing.length, answers: await currentAnswers(owner) });
    }

    if (body.action === "bulk") {
      const parsed = parseBulk(body.text);
      const result = await owner.supabase
        .from("submissions")
        .insert(parsed.map(item => rowForAnswer(owner.project.id, item)));
      if (result.error) throw result.error;
      return NextResponse.json({ added: parsed.length, answers: await currentAnswers(owner) });
    }

    const answer = body.answer;
    const normalized: FamilyQaAnswer = {
      id: "id" in answer && answer.id ? answer.id : `manual-${crypto.randomUUID()}`,
      contributorName: answer.contributorName,
      relationship: answer.relationship,
      question: answer.question,
      answer: answer.answer,
      chapterNumber: answer.chapterNumber,
      when: answer.when,
      place: answer.place,
      chorusKeys: answer.chorusKeys,
      photoAssetIds: answer.photoAssetIds,
      photoRefs: answer.photoRefs,
      showInChapter: answer.showInChapter,
      ...(answer.editorialNote ? { editorialNote: answer.editorialNote } : {})
    };

    if (body.action === "create") {
      const result = await owner.supabase
        .from("submissions")
        .insert(rowForAnswer(owner.project.id, normalized, answer.visible));
      if (result.error) throw result.error;
    } else {
      const result = await owner.supabase
        .from("submissions")
        .update({
          name: normalized.contributorName,
          relationship: normalized.relationship,
          first_memory: normalized.answer,
          approximate_year: normalized.when,
          location: normalized.place,
          life_chapter: chapterLabel(normalized.chapterNumber),
          prompt: normalized.question,
          review_status: answer.visible ? "included" : "excluded",
          reviewer_notes: encodeFamilyQaMetadata(normalized)
        })
        .eq("id", answer.id)
        .eq("project_id", owner.project.id)
        .eq("status", "family_qa");
      if (result.error) throw result.error;
    }

    return NextResponse.json({ answers: await currentAnswers(owner) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Review the required Q&A fields." }, { status: 400 });
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The family Q&A could not be saved."
    }, { status: 400 });
  }
}
