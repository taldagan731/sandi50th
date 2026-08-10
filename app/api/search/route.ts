import { NextResponse } from "next/server";
import { z } from "zod";
import { STORY_CHAPTERS, isTestContributor } from "@/lib/chapters";
import { displayChapterForSubmission, genuineSubmissionText } from "@/lib/submission-display";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudioOwner } from "@/lib/studio/auth";
import { hasRevealPreviewAccess } from "@/lib/reveal-preview";
import { getRevealShareAccess } from "@/lib/reveal-share";
import { getRevealProject } from "@/lib/reveal-visibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.string().trim().min(2).max(80);

type SearchResult = {
  id: string;
  kind: "chapter" | "text" | "photo" | "media";
  title: string;
  detail: string;
  href: string;
  chapterNumber: number | null;
};

function searchable(value: unknown) {
  return String(value ?? "").normalize("NFKD").toLocaleLowerCase();
}

function excerpt(value: string, limit = 118) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1).trimEnd()}…` : clean;
}

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(new URL(request.url).searchParams.get("q") ?? "");
  if (!parsed.success) return NextResponse.json({ results: [] });

  const owner = await requireStudioOwner();
  const ownerPreview = owner ? false : await hasRevealPreviewAccess();
  const share = owner || ownerPreview ? null : await getRevealShareAccess();
  const publicProject = await getRevealProject();
  const project = owner?.project ?? publicProject;
  const maySearch = Boolean(owner || ownerPreview || (share && project && share.projectId === project.id) || publicProject?.revealPublic);
  if (!project || !maySearch) return NextResponse.json({ results: [], locked: true }, { status: 403 });

  const supabase = owner?.supabase ?? createAdminClient();
  const needle = searchable(parsed.data);
  const { data: submissions, error: submissionError } = await supabase
    .from("submissions")
    .select("id,name,relationship,prompt,first_memory,story,approximate_year,location,life_chapter,status,review_status")
    .eq("project_id", project.id)
    .neq("review_status", "excluded")
    .limit(1000);
  if (submissionError) return NextResponse.json({ error: "Search is temporarily unavailable." }, { status: 503 });

  const visibleSubmissions = (submissions ?? []).filter(item => !isTestContributor(item.name));
  const submissionIds = visibleSubmissions.map(item => item.id);
  const submissionById = new Map(visibleSubmissions.map(item => [item.id, item]));
  let media: Array<Record<string, unknown>> = [];

  if (submissionIds.length) {
    const enriched = await supabase
      .from("media_assets")
      .select("id,submission_id,original_name,mime_type,caption,chapter_number,review_status,analysis_description,analysis_objects,analysis_event_clues")
      .in("submission_id", submissionIds)
      .neq("review_status", "excluded")
      .limit(1000);
    if (enriched.error && (enriched.error.code === "42703" || /analysis_/i.test(enriched.error.message))) {
      const fallback = await supabase
        .from("media_assets")
        .select("id,submission_id,original_name,mime_type,caption,chapter_number,review_status")
        .in("submission_id", submissionIds)
        .neq("review_status", "excluded")
        .limit(1000);
      if (!fallback.error) media = (fallback.data ?? []) as Array<Record<string, unknown>>;
    } else if (!enriched.error) {
      media = (enriched.data ?? []) as Array<Record<string, unknown>>;
    }
  }

  const mediaIds = new Set(media.map(item => String(item.id)));
  const namesByMedia = new Map<string, string[]>();
  if (mediaIds.size) {
    const { data: tags } = await supabase
      .from("photo_face_tags")
      .select("media_asset_id,person_name")
      .eq("project_id", project.id)
      .eq("status", "confirmed")
      .neq("person_name", "")
      .limit(2000);
    for (const tag of tags ?? []) {
      const key = String(tag.media_asset_id);
      if (!mediaIds.has(key)) continue;
      const names = namesByMedia.get(key) ?? [];
      if (!names.some(name => searchable(name) === searchable(tag.person_name))) names.push(String(tag.person_name));
      namesByMedia.set(key, names);
    }
  }

  const results: SearchResult[] = [];
  STORY_CHAPTERS.forEach((title, index) => {
    if (searchable(`${index + 1} ${title}`).includes(needle)) results.push({ id: `chapter-${index + 1}`, kind: "chapter", title, detail: `Chapter ${String(index + 1).padStart(2, "0")}`, href: `/reveal?chapter=${index + 1}#reveal-story-room`, chapterNumber: index + 1 });
  });

  for (const item of visibleSubmissions) {
    const text = genuineSubmissionText(item);
    if (!text) continue;
    const chapterNumber = displayChapterForSubmission(item);
    const haystack = searchable([item.name, item.relationship, text.firstMemory, text.story, item.approximate_year, item.location, item.prompt].join(" "));
    if (!haystack.includes(needle)) continue;
    const body = text.firstMemory || text.story;
    results.push({ id: `text-${item.id}`, kind: "text", title: excerpt(body), detail: `Written by ${item.name || "Someone who loves Sandi"} · Chapter ${String(chapterNumber).padStart(2, "0")}`, href: `/reveal?chapter=${chapterNumber}&memory=${item.id}#memory-${item.id}`, chapterNumber });
  }

  for (const item of media) {
    const id = String(item.id);
    const submission = submissionById.get(String(item.submission_id));
    const names = namesByMedia.get(id) ?? [];
    const description = String(item.caption || item.analysis_description || "").trim();
    const originalName = String(item.original_name || "Photograph");
    const haystack = searchable([originalName, description, item.analysis_objects, item.analysis_event_clues, submission?.name, ...names].join(" "));
    if (!haystack.includes(needle)) continue;
    const chapterNumber = Number(item.chapter_number) || (submission ? displayChapterForSubmission(submission) : 7);
    const isPhoto = String(item.mime_type).startsWith("image/");
    const peopleDetail = names.length ? ` · ${names.join(", ")}` : "";
    const contributorDetail = submission?.name ? ` from ${submission.name}` : "";
    const query = new URLSearchParams();
    if (chapterNumber) query.set("chapter", String(chapterNumber));
    if (isPhoto) query.set("media", id);
    results.push({ id: `media-${id}`, kind: isPhoto ? "photo" : "media", title: excerpt(description || originalName), detail: `${isPhoto ? "Photograph" : "Media"}${contributorDetail}${peopleDetail}`, href: `/reveal?${query.toString()}${isPhoto ? "" : "#archive-films"}`, chapterNumber: chapterNumber || null });
  }

  const ordered = results.sort((a, b) => (a.kind === "chapter" ? -1 : b.kind === "chapter" ? 1 : 0)).slice(0, 36);
  return NextResponse.json({ results: ordered, count: ordered.length }, { headers: { "Cache-Control": "private, max-age=30" } });
}
