import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createImageDerivative, isHeicMedia, type DerivativeMedia } from "@/lib/media-derivatives";
import { hasRevealPreviewAccess } from "@/lib/reveal-preview";
import { requireStudioOwner } from "@/lib/studio/auth";
import { getRevealProject } from "@/lib/reveal-visibility";

export const runtime = "nodejs";
export const maxDuration = 300;

const postSchema = z.object({ limit: z.number().int().min(1).max(8).default(4) });

async function requireOwnerOrPreview() {
  const owner = await requireStudioOwner();
  if (owner) return { supabase: owner.supabase, projectId: owner.project.id };
  if (!await hasRevealPreviewAccess()) return null;
  const project = await getRevealProject();
  if (!project) return null;
  return { supabase: createAdminClient(), projectId: project.id };
}

async function inventory(auth: NonNullable<Awaited<ReturnType<typeof requireOwnerOrPreview>>>) {
  const { data: submissions, error: submissionError } = await auth.supabase
    .from("submissions")
    .select("id")
    .eq("project_id", auth.projectId);
  if (submissionError) throw submissionError;
  const submissionIds = (submissions ?? []).map(item => item.id);
  if (!submissionIds.length) return [] as DerivativeMedia[];

  const { data, error } = await auth.supabase
    .from("media_assets")
    .select("id,submission_id,storage_path,original_name,mime_type,bytes,poster_path,chapter_number")
    .in("submission_id", submissionIds)
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as DerivativeMedia[]).filter(isHeicMedia);
}

function summarize(items: DerivativeMedia[]) {
  return {
    heicTotal: items.length,
    ready: items.filter(item => Boolean(item.poster_path)).length,
    remaining: items.filter(item => !item.poster_path).length,
    originalBytes: items.reduce((total, item) => total + Number(item.bytes || 0), 0),
    byChapter: Object.fromEntries(Array.from({ length: 8 }, (_, index) => {
      const chapter = index + 1;
      const chapterItems = items.filter(item => item.chapter_number === chapter);
      return [chapter, { total: chapterItems.length, ready: chapterItems.filter(item => Boolean(item.poster_path)).length }];
    }))
  };
}

export async function GET() {
  const auth = await requireOwnerOrPreview();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(summarize(await inventory(auth)));
  } catch (error) {
    console.error("media-derivative-inventory", error);
    return NextResponse.json({ error: "The media readiness check could not finish." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOwnerOrPreview();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { limit } = postSchema.parse(await request.json().catch(() => ({})));
    const beforeItems = await inventory(auth);
    const candidates = beforeItems.filter(item => !item.poster_path).slice(0, limit);
    const results = [];
    for (const media of candidates) results.push(await createImageDerivative(auth.supabase, media));
    const afterItems = await inventory(auth);
    return NextResponse.json({
      ok: true,
      before: summarize(beforeItems),
      after: summarize(afterItems),
      attempted: candidates.length,
      addedStorageBytes: results.reduce((total, result) => total + (result.derivativeBytes ?? 0), 0),
      results
    });
  } catch (error) {
    console.error("media-derivative-batch", error);
    return NextResponse.json({ error: "The presentation-copy batch could not finish." }, { status: 500 });
  }
}
