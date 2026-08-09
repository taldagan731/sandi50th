import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashRevealShareToken } from "@/lib/reveal-share";
import { requireStudioOwner } from "@/lib/studio/auth";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), expiresAt: z.string().datetime() }),
  z.object({ action: z.literal("revoke"), id: z.string().uuid() })
]);

function migrationMissing(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42P01" || /reveal_share_links|reveal_share_visits/i.test(error.message ?? "")));
}

async function status(owner: NonNullable<Awaited<ReturnType<typeof requireStudioOwner>>>) {
  const { data: link, error } = await owner.supabase
    .from("reveal_share_links")
    .select("id,expires_at,revoked_at,created_at")
    .eq("project_id", owner.project.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (migrationMissing(error)) return { migrationRequired: true, active: null };
  if (error) throw error;
  if (!link) return { migrationRequired: false, active: null };

  const { count } = await owner.supabase
    .from("reveal_share_visits")
    .select("id", { count: "exact", head: true })
    .eq("share_link_id", link.id);
  const { data: latestVisit } = await owner.supabase
    .from("reveal_share_visits")
    .select("visited_at")
    .eq("share_link_id", link.id)
    .order("visited_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const active = !link.revoked_at && new Date(link.expires_at).getTime() > Date.now();
  return {
    migrationRequired: false,
    active: {
      id: link.id,
      enabled: active,
      expiresAt: link.expires_at,
      revokedAt: link.revoked_at,
      createdAt: link.created_at,
      useCount: count ?? 0,
      lastUsedAt: latestVisit?.visited_at ?? null
    }
  };
}

export async function GET() {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await status(owner));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Guest-link status could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = requestSchema.parse(await request.json());
    if (body.action === "revoke") {
      const { error } = await owner.supabase
        .from("reveal_share_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", body.id)
        .eq("project_id", owner.project.id);
      if (migrationMissing(error)) return NextResponse.json({ error: "Install supabase/reveal-share-links-migration.sql first." }, { status: 503 });
      if (error) throw error;
      return NextResponse.json({ ok: true, ...(await status(owner)) });
    }

    const expiresAt = new Date(body.expiresAt);
    if (expiresAt.getTime() <= Date.now()) return NextResponse.json({ error: "Choose a future expiry." }, { status: 400 });
    await owner.supabase
      .from("reveal_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("project_id", owner.project.id)
      .is("revoked_at", null);

    const id = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const { error } = await owner.supabase.from("reveal_share_links").insert({
      id,
      project_id: owner.project.id,
      token_hash: hashRevealShareToken(token),
      expires_at: expiresAt.toISOString(),
      created_by: owner.user.id
    });
    if (migrationMissing(error)) return NextResponse.json({ error: "Install supabase/reveal-share-links-migration.sql first." }, { status: 503 });
    if (error) throw error;

    const url = new URL(`/reveal/share/${id}/${token}`, request.url);
    return NextResponse.json({ ok: true, url: url.toString(), ...(await status(owner)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Guest-link access could not be changed." }, { status: 400 });
  }
}
