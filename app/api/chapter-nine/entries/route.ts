import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CHAPTER_NINE_AUTHOR,
  CHAPTER_NINE_LABEL,
  CHAPTER_NINE_PROMPT,
  CHAPTER_NINE_RELATIONSHIP,
  requireChapterNineSession
} from "@/lib/chapter-nine";

const MAX_FILES = 24;
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

const fileSchema = z.object({
  name: z.string().min(1).max(500),
  type: z.string().min(1).max(150),
  size: z.number().int().positive().max(MAX_FILE_BYTES)
});

const createSchema = z.object({
  body: z.string().trim().min(1).max(12000),
  dateLabel: z.string().trim().min(1).max(120),
  files: z.array(fileSchema).max(MAX_FILES).default([])
});

function safeName(name: string) {
  const normalized = name.replace(/\\/g, "/").split("/").pop() || "memory";
  const dot = normalized.lastIndexOf(".");
  const ext = dot >= 0 ? normalized.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
  const stem = (dot >= 0 ? normalized.slice(0, dot) : normalized)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "memory";
  return `${stem}${ext.slice(0, 16)}`;
}

function imageTypeAllowed(type: string) {
  return [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif"
  ].includes(type);
}

export async function GET() {
  const auth = await requireChapterNineSession();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: submissions, error } = await supabase
    .from("submissions")
    .select("id,name,first_memory,approximate_year,created_at,upload_completed_at,review_status")
    .eq("project_id", auth.projectId)
    .eq("prompt", CHAPTER_NINE_PROMPT)
    .neq("review_status", "excluded")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (submissions ?? []).map(item => item.id);
  const { data: media, error: mediaError } = ids.length
    ? await supabase
      .from("media_assets")
      .select("id,submission_id,original_name,mime_type,bytes,created_at")
      .in("submission_id", ids)
      .eq("review_status", "included")
      .order("created_at")
    : { data: [], error: null };
  if (mediaError) return NextResponse.json({ error: mediaError.message }, { status: 500 });

  const bySubmission = new Map<string, Array<Record<string, unknown>>>();
  for (const item of media ?? []) {
    const current = bySubmission.get(String(item.submission_id)) ?? [];
    current.push(item as Record<string, unknown>);
    bySubmission.set(String(item.submission_id), current);
  }

  return NextResponse.json({
    entries: (submissions ?? []).map(item => ({
      id: item.id,
      body: item.first_memory,
      dateLabel: item.approximate_year,
      createdAt: item.created_at,
      updatedAt: item.upload_completed_at || item.created_at,
      media: bySubmission.get(item.id) ?? []
    }))
  });
}

export async function POST(request: Request) {
  const auth = await requireChapterNineSession();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = createSchema.parse(await request.json());
    const totalBytes = body.files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: "This page exceeds the 2 GB image limit." }, { status: 400 });
    }
    for (const file of body.files) {
      if (!imageTypeAllowed(file.type)) {
        return NextResponse.json({ error: `${file.name} is not an accepted image type.` }, { status: 400 });
      }
    }

    const supabase = createAdminClient();
    const { data: submission, error } = await supabase
      .from("submissions")
      .insert({
        project_id: auth.projectId,
        name: CHAPTER_NINE_AUTHOR,
        contact: CHAPTER_NINE_LABEL,
        relationship: CHAPTER_NINE_RELATIONSHIP,
        first_memory: body.body,
        story: "",
        approximate_year: body.dateLabel,
        life_chapter: "9 — Still Becoming",
        prompt: CHAPTER_NINE_PROMPT,
        consent: true,
        status: "chapter-nine",
        review_status: "included"
      })
      .select("id")
      .single();
    if (error || !submission) throw error ?? new Error("Could not create the entry.");

    const uploads = body.files.map((file, index) => ({
      pathname: `incoming/${submission.id}/${String(index + 1).padStart(3, "0")}-${crypto.randomUUID()}-${safeName(file.name)}`,
      name: file.name,
      type: file.type,
      size: file.size
    }));

    return NextResponse.json({ entryId: submission.id, uploads });
  } catch (error) {
    console.error("chapter-nine-create", error);
    return NextResponse.json({ error: "This page could not be added yet." }, { status: 400 });
  }
}
