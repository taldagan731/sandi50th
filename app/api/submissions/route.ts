import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultReviewStatus } from "@/lib/chapters";
import { requireStudioOwner } from "@/lib/studio/auth";

export const runtime = "nodejs";

const MAX_FILES = 500;
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "video/", "audio/"];
const ALLOWED_EXACT = new Set(["application/pdf", "application/zip", "application/x-zip-compressed"]);

const requestSchema = z.object({
  sourceType: z.enum(["contributor", "owner_archive"]).default("contributor"),
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
    name: z.string().min(1).max(500),
    type: z.string().min(1).max(150),
    size: z.number().int().positive().max(MAX_FILE_BYTES)
  })).max(MAX_FILES)
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

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const isOwnerArchive = body.sourceType === "owner_archive";
    if (isOwnerArchive && !await requireStudioOwner()) {
      return NextResponse.json({ error: "Owner archive imports require a Studio owner session." }, { status: 401 });
    }
    const totalBytes = body.files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: "This contribution exceeds the 10 GB session limit." }, { status: 400 });
    }

    for (const file of body.files) {
      const allowed = ALLOWED_PREFIXES.some(prefix => file.type.startsWith(prefix)) || ALLOWED_EXACT.has(file.type);
      if (!allowed) {
        return NextResponse.json({ error: `${file.name} is not an accepted photo, video, audio, ZIP, or PDF file.` }, { status: 400 });
      }
    }

    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", "sandi50th")
      .single();
    if (projectError || !project) throw projectError ?? new Error("Project not found.");

    const archiveFields = isOwnerArchive ? {
      name: "Owner archive",
      contact: "Private owner import",
      relationship: "Owner archive",
      firstMemory: "Owner archive batch",
      prompt: "OWNER_ARCHIVE"
    } : {
      name: body.name,
      contact: body.contact,
      relationship: body.relationship,
      firstMemory: body.firstMemory,
      prompt: body.prompt
    };
    const reviewStatus = defaultReviewStatus(archiveFields.name);
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        project_id: project.id,
        name: archiveFields.name,
        contact: archiveFields.contact,
        relationship: archiveFields.relationship,
        first_memory: archiveFields.firstMemory,
        story: body.story,
        approximate_year: body.approximateYear,
        location: body.place,
        people: body.people ? body.people.split(",").map(value => value.trim()).filter(Boolean) : [],
        life_chapter: body.lifeChapter,
        prompt: archiveFields.prompt,
        consent: body.consent,
        review_status: reviewStatus,
        status: reviewStatus === "excluded" ? "excluded" : "received"
      })
      .select("id")
      .single();
    if (submissionError || !submission) {
      throw submissionError ?? new Error("Could not create submission.");
    }

    const uploads = body.files.map((file, index) => ({
      pathname: `incoming/${submission.id}/${String(index + 1).padStart(3, "0")}-${crypto.randomUUID()}-${safeName(file.name)}`,
      name: file.name,
      type: file.type,
      size: file.size
    }));

    return NextResponse.json({ submissionId: submission.id, uploads });
  } catch (error) {
    console.error("submission-init", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Please review the required fields and file limits." }, { status: 400 });
    }
    return NextResponse.json({
      error: "We could not prepare the secure upload. Your form is still here—please try again or email uploads@sandi50th.com."
    }, { status: 500 });
  }
}
