import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

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
      if (!allowed) {
        return NextResponse.json({ error: `${file.name} is not an accepted photo, video, audio, or PDF file.` }, { status: 400 });
      }
    }

    const submissionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const uploads = body.files.map((file, index) => ({
      pathname: `incoming/${submissionId}/${String(index + 1).padStart(2, "0")}-${crypto.randomUUID()}-${safeName(file.name)}`,
      name: file.name,
      type: file.type,
      size: file.size
    }));

    await put(
      `submissions/${submissionId}/draft.json`,
      JSON.stringify({
        version: 1,
        submissionId,
        status: "prepared",
        createdAt,
        contributor: {
          name: body.name,
          contact: body.contact,
          relationship: body.relationship
        },
        memory: {
          firstMemory: body.firstMemory,
          story: body.story,
          approximateYear: body.approximateYear,
          place: body.place,
          people: body.people.split(",").map(value => value.trim()).filter(Boolean),
          lifeChapter: body.lifeChapter,
          prompt: body.prompt
        },
        consent: body.consent,
        requestedFiles: uploads
      }),
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json"
      }
    );

    return NextResponse.json({ submissionId, uploads });
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
