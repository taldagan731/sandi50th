import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudioOwner } from "@/lib/studio/auth";
import { hasRevealPreviewAccess } from "@/lib/reveal-preview";
import { getRevealShareAccess } from "@/lib/reveal-share";
import { getRevealProject } from "@/lib/reveal-visibility";
import { isTestContributor } from "@/lib/chapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mediaIdSchema = z.string().uuid();
const storySchema = z.object({
  mediaId: mediaIdSchema,
  authorName: z.string().trim().max(80).optional().default(""),
  people: z.array(z.string().trim().min(1).max(80)).max(12).optional().default([]),
  memory: z.string().trim().max(1200).optional().default(""),
  website: z.string().max(0).optional().default("")
}).refine(value => value.people.length > 0 || value.memory.length > 0, {
  message: "Add at least one person or a memory."
});

type RateEntry = { startedAt: number; count: number };
const rateWindow = new Map<string, RateEntry>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_WRITES = 8;

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function rateLimited(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  const entry = rateWindow.get(key);
  if (!entry || now - entry.startedAt > WINDOW_MS) {
    rateWindow.set(key, { startedAt: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_WRITES;
}

function publicStory(row: { id: string; author_name: string; people_tags: string[] | null; memory: string | null; created_at: string }) {
  return {
    id: row.id,
    authorName: row.author_name,
    people: row.people_tags ?? [],
    memory: row.memory ?? "",
    createdAt: row.created_at
  };
}

type RevealAccess = { supabase: ReturnType<typeof createAdminClient>; projectId: string; owner: boolean };

async function revealAccess(): Promise<RevealAccess | null> {
  const owner = await requireStudioOwner();
  if (owner) return { supabase: owner.supabase, projectId: owner.project.id, owner: true };
  const ownerPreview = await hasRevealPreviewAccess();
  const guestShare = !ownerPreview ? await getRevealShareAccess() : null;
  const project = await getRevealProject();
  const guestCanView = Boolean(guestShare && project && guestShare.projectId === project.id);
  if (!project || (!ownerPreview && !guestCanView && !project.revealPublic)) return null;
  return { supabase: createAdminClient(), projectId: project.id, owner: false };
}

async function mediaProject(mediaId: string, access: RevealAccess) {
  const { data: media } = await access.supabase.from("media_assets").select("id,submission_id,review_status").eq("id", mediaId).maybeSingle();
  if (!media || (!access.owner && media.review_status === "excluded")) return null;
  const { data: submission } = await access.supabase.from("submissions").select("project_id,name,review_status").eq("id", media.submission_id).eq("project_id", access.projectId).maybeSingle();
  if (!submission || (!access.owner && (submission.review_status === "excluded" || isTestContributor(submission.name)))) return null;
  return access;
}

export async function GET(request: Request) {
  const mediaId = new URL(request.url).searchParams.get("mediaId");
  const parsedId = mediaIdSchema.safeParse(mediaId);
  if (!parsedId.success) return NextResponse.json({ stories: [] }, { status: 400 });
  const access = await revealAccess();
  if (!access) return NextResponse.json({ stories: [] }, { status: 404 });
  const owner = await mediaProject(parsedId.data, access);
  if (!owner) return NextResponse.json({ stories: [] }, { status: 404 });
  const { data, error } = await owner.supabase
    .from("photo_stories")
    .select("id,author_name,people_tags,memory,created_at")
    .eq("project_id", owner.projectId)
    .eq("media_asset_id", parsedId.data)
    .eq("status", "visible")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) {
    if (error.code === "42P01") return NextResponse.json({ stories: [], unavailable: true });
    console.error("photo-stories-read", error);
    return NextResponse.json({ stories: [] }, { status: 500 });
  }
  return NextResponse.json({ stories: (data ?? []).map(publicStory) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (rateLimited(request)) return NextResponse.json({ error: "Please wait a few minutes before adding another story." }, { status: 429 });
  const parsed = storySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check the highlighted fields." }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ ok: true });
  const access = await revealAccess();
  if (!access) return NextResponse.json({ error: "This photograph is not available." }, { status: 404 });
  const owner = await mediaProject(parsed.data.mediaId, access);
  if (!owner) return NextResponse.json({ error: "This photograph is not available." }, { status: 404 });
  const people = Array.from(new Set(parsed.data.people.map(name => name.replace(/\s+/g, " ").trim()).filter(Boolean)));
  const { data, error } = await owner.supabase.from("photo_stories").insert({
    project_id: owner.projectId,
    media_asset_id: parsed.data.mediaId,
    author_name: parsed.data.authorName || "Someone who remembers",
    people_tags: people,
    memory: parsed.data.memory || null,
    status: "visible"
  }).select("id,author_name,people_tags,memory,created_at").single();
  if (error) {
    if (error.code === "42P01") return NextResponse.json({ error: "Photo stories are being prepared." }, { status: 503 });
    console.error("photo-stories-write", error);
    return NextResponse.json({ error: "That story could not be saved. Please try once more." }, { status: 500 });
  }
  return NextResponse.json({ story: publicStory(data) }, { status: 201 });
}
