import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REVEAL_SHARE_COOKIE, revealShareCookieOptions, validateRevealShare } from "@/lib/reveal-share";

export const runtime = "nodejs";

function visitorHash(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const secret = process.env.OWNER_PREVIEW_SECRET || process.env.CRON_SECRET || "sandi50th-guest-log";
  return createHmac("sha256", secret).update(address).digest("hex");
}

export async function GET(request: Request, context: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await context.params;
  const access = await validateRevealShare(id, token);
  if (!access) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow, noarchive" } });

  const supabase = createAdminClient();
  await supabase.from("reveal_share_visits").insert({
    share_link_id: access.id,
    ip_hash: visitorHash(request),
    user_agent: (request.headers.get("user-agent") || "unknown").slice(0, 500)
  });

  const response = NextResponse.redirect(new URL("/reveal", request.url));
  response.cookies.set(REVEAL_SHARE_COOKIE, `${access.id}.${token}`, revealShareCookieOptions(access.expiresAt));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}
