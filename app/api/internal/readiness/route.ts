import { timingSafeEqual } from "node:crypto";
import { list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isTestContributor } from "@/lib/chapters";
import { globalPhotoPilotStatus } from "@/lib/photo-intelligence";
import { buildContributionReport } from "@/lib/studio/contribution-report";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuditMedia = {
  id: string;
  submission_id: string;
  original_name: string | null;
  mime_type: string | null;
  review_status: string | null;
  chapter_number: number | null;
  canonical_media_id: string | null;
  poster_path: string | null;
};

function authorized(request: Request) {
  const expected = process.env.INTERNAL_AUDIT_TOKEN;
  const supplied = request.headers.get("x-internal-audit-token");
  if (process.env.VERCEL_ENV !== "preview" || !expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = createAdminClient();
  const { data: project, error: projectError } = await supabase
    .from("projects").select("id,reveal_public").eq("slug", "sandi50th").single();
  if (projectError || !project) return NextResponse.json({ error: "Project unavailable" }, { status: 503 });

  const { data: memberships, error: membershipError } = await supabase
    .from("project_members").select("user_id,role")
    .eq("project_id", project.id).eq("role", "owner");
  const owners = await Promise.all((memberships ?? []).map(async membership => {
    const { data } = await supabase.auth.admin.getUserById(membership.user_id);
    const user = data.user;
    return {
      authUserExists: Boolean(user),
      emailConfirmed: Boolean(user?.email_confirmed_at),
      emailProvider: Boolean(user?.app_metadata?.providers?.includes("email") || user?.app_metadata?.provider === "email"),
      hasSignedIn: Boolean(user?.last_sign_in_at)
    };
  }));

  const { data: rawSubmissions, error: submissionError } = await supabase
    .from("submissions")
    .select("id,name,status,review_status,first_memory,story,life_chapter,prompt")
    .eq("project_id", project.id).order("created_at");
  if (submissionError) return NextResponse.json({ error: "Contributions unavailable" }, { status: 503 });
  const submissions = (rawSubmissions ?? []).filter(item => !isTestContributor(item.name));
  const ids = submissions.map(item => item.id);
  const { data: media, error: mediaError } = ids.length
    ? await supabase.from("media_assets")
        .select("id,submission_id,original_name,mime_type,review_status,chapter_number,canonical_media_id,poster_path")
        .in("submission_id", ids).order("created_at")
    : { data: [], error: null };
  if (mediaError) return NextResponse.json({ error: "Media unavailable", detail: mediaError.message }, { status: 503 });

  const mediaRows = (media ?? []) as AuditMedia[];
  const bySubmission = new Map<string, AuditMedia[]>();
  for (const item of mediaRows) {
    const current = bySubmission.get(item.submission_id) ?? [];
    current.push(item);
    bySubmission.set(item.submission_id, current);
  }
  const report = buildContributionReport(submissions.map(item => ({ ...item, media: bySubmission.get(item.id) ?? [] })));
  const visibleMedia = mediaRows.filter(item => item.review_status !== "excluded");
  const canonical = new Set(visibleMedia.map(item => item.canonical_media_id ?? item.id));
  const photoPilot = await globalPhotoPilotStatus();

  let backup = { available: false, manifests: 0, mediaCopies: 0, latest: null as string | null };
  try {
    const blobs = await list({ prefix: "backups/", limit: 1000 });
    const dates = blobs.blobs.map(item => item.uploadedAt.toISOString()).sort();
    backup = {
      available: true,
      manifests: blobs.blobs.filter(item => item.pathname.endsWith("/manifest.json")).length,
      mediaCopies: blobs.blobs.filter(item => item.pathname.includes("/media/")).length,
      latest: dates.at(-1) ?? null
    };
  } catch {}

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    access: {
      membershipRequired: true,
      membershipQuerySucceeded: !membershipError,
      ownerMembershipCount: memberships?.length ?? 0,
      owners,
      supabaseSiteUrlMustNotBeLocalhost: true
    },
    report,
    reveal: {
      public: Boolean(project.reveal_public),
      realSubmissions: submissions.length,
      visibleMediaRows: visibleMedia.length,
      assembledCanonicalItems: canonical.size,
      testRecordsIncluded: false,
      runtimeMeasured: false
    },
    operations: {
      arrivalEmailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.CONTRIBUTION_ALERT_EMAIL),
      arrivalEmailSenderConfigured: Boolean(process.env.CONTRIBUTION_ALERT_FROM),
      photoPilot,
      backup,
      posterFramesMissing: visibleMedia.filter(item => item.mime_type?.startsWith("video/") && !item.poster_path).length,
      soundtrackConfigured: true
    }
  }, { headers: { "Cache-Control": "private, no-store" } });
}
