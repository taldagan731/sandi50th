import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_FILES = 20;
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "video/", "audio/"];
const ALLOWED_EXACT = new Set(["application/pdf"]);

const requestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  contact: z.string().trim().min(1).max(200),
  relationship: z.string().trim().max(100).default("Other"),
  firstMemory: z.string().trim().min(1).max(5000),
  story: z.string().trim().max(10000).optional().default(""),
  approximateYear: z.string().trim().max(100).optional().default(""),
  place: z.string().trim().max(250).optional().default(""),
  people: z.string().trim().max(1000).optional().default(""),
  lifeChapter: z.string().trim().max(150).optional().default("Not sure"),
  prompt: z.string().trim().max(500).optional().default(""),
  consent: z.literal(true),
  files: z.array(z.object({
    name: z.string().min(1).max(300),
    type: z.string().min(1).max(150),
    size: z.number().int().positive().max(MAX_FILE_BYTES)
  })).max(MAX_FILES)
});

function safeName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
  const stem = (dot >= 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "memory";
  return `${stem}${ext.slice(0, 12)}`;
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const totalBytes = body.files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: "This contribution exceeds the 10 GB session limit." }, { status: 400 });
    }

    for (const file of body.files) {
      const allowed = ALLOWED_PREFIXES.some(prefix => file.type.startsWith(prefix)) || ALLOWED_EXACT.has(file.type);
      if (!allowed) return NextResponse.json({ error: `${file.name} is not an accepted file type.` }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", "sandi50th")
      .single();
    if (projectError || !project) throw projectError ?? new Error("Project not found.");

    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        project_id: project.id,
        name: body.name,
        contact: body.contact,
        relationship: body.relationship,
        first_memory: body.firstMemory,
        story: body.story,
        approximate_year: body.approximateYear,
        location: body.place,
        people: body.people ? body.people.split(",").map(value => value.trim()).filter(Boolean) : [],
        life_chapter: body.lifeChapter,
        prompt: body.prompt,
        consent: body.consent,
        status: "received"
      })
      .select("id")
      .single();
    if (submissionError || !submission) throw submissionError ?? new Error("Could not create submission.");

    const uploads = [];
    for (let index = 0; index < body.files.length; index += 1) {
      const file = body.files[index];
      const path = `${submission.id}/${String(index + 1).padStart(2, "0")}-${crypto.randomUUID()}-${safeName(file.name)}`;
      const { data, error } = await supabase.storage.from("sandi-memories").createSignedUploadUrl(path);
      if (error || !data) throw error ?? new Error(`Could not prepare ${file.name}.`);
      uploads.push({ path, token: data.token, name: file.name, type: file.type, size: file.size });
    }

    return NextResponse.json({ submissionId: submission.id, uploads });
  } catch (error) {
    console.error("submission-init", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Please review the required fields and file limits." }, { status: 400 });
    }
    return NextResponse.json({ error: "The secure upload could not be prepared. Please try again." }, { status: 500 });
  }
}
