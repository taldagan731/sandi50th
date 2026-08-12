import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAPTER_NINE_PROMPT, requireChapterNineSession } from "@/lib/chapter-nine";

const MAX_FILES = 24;
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

const fileSchema = z.object({
  name: z.string().min(1).max(500),
  type: z.string().min(1).max(150),
  size: z.number().int().positive().max(MAX_FILE_BYTES)
});

const updateSchema = z.object({
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

async function assertEntry(projectId: string, id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("id")
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("prompt", CHAPTER_NINE_PROMPT)
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Entry not found.");
  return data;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireChapterNineSession();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    await assertEntry(auth.projectId, id);
    const body = updateSchema.parse(await request.json());
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
    const { error } = await supabase
      .from("submissions")
      .update({
        first_memory: body.body,
        approximate_year: body.dateLabel,
        status: "chapter-nine",
        review_status: "included"
      })
      .eq("id", id);
    if (error) throw error;

    const uploads = body.files.map((file, index) => ({
      pathname: `incoming/${id}/${String(index + 1).padStart(3, "0")}-${crypto.randomUUID()}-${safeName(file.name)}`,
      name: file.name,
      type: file.type,
      size: file.size
    }));

    return NextResponse.json({ entryId: id, uploads });
  } catch (error) {
    console.error("chapter-nine-update", error);
    return NextResponse.json({ error: "This page could not be updated yet." }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireChapterNineSession();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    await assertEntry(auth.projectId, id);
    const supabase = createAdminClient();
    await supabase
      .from("media_assets")
      .update({ review_status: "excluded" })
      .eq("submission_id", id);
    const { error } = await supabase
      .from("submissions")
      .update({ review_status: "excluded", status: "deleted" })
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("chapter-nine-delete", error);
    return NextResponse.json({ error: "This page could not be removed." }, { status: 400 });
  }
}
