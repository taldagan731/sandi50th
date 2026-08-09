import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAccess } from "@/lib/studio/auth";

const schema = z.object({ revealPublic: z.boolean() });

function migrationMissing(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42703" || /reveal_public|reveal_opened_at/i.test(error.message ?? "")));
}

export async function GET() {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await owner.supabase
    .from("projects")
    .select("reveal_public,reveal_opened_at")
    .eq("id", owner.project.id)
    .single();

  if (migrationMissing(error)) {
    return NextResponse.json({
      error: "Install supabase/default-visible-reveal-migration.sql to enable the reveal switch."
    }, { status: 503 });
  }
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Project not found." }, { status: 500 });

  return NextResponse.json({
    revealPublic: Boolean(data.reveal_public),
    revealOpenedAt: data.reveal_opened_at ?? null
  });
}

export async function POST(request: Request) {
  const owner = await requireStudioAccess();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = schema.parse(await request.json());
    const { data, error } = await owner.supabase
      .from("projects")
      .update({
        reveal_public: body.revealPublic,
        reveal_opened_at: body.revealPublic ? new Date().toISOString() : null
      })
      .eq("id", owner.project.id)
      .select("reveal_public,reveal_opened_at")
      .single();

    if (migrationMissing(error)) {
      return NextResponse.json({
        error: "Install supabase/default-visible-reveal-migration.sql to enable the reveal switch."
      }, { status: 503 });
    }
    if (error || !data) throw error ?? new Error("Project not found.");

    return NextResponse.json({
      ok: true,
      revealPublic: Boolean(data.reveal_public),
      revealOpenedAt: data.reveal_opened_at ?? null
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Reveal access could not be changed."
    }, { status: 400 });
  }
}
