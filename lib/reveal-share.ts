import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const REVEAL_SHARE_COOKIE = "sandi-reveal-share";

export function hashRevealShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function revealShareCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
    ...(process.env.VERCEL_ENV === "production" ? { domain: ".sandi50th.com" } : {})
  };
}

function tokenMatches(token: string, expectedHash: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token) || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const actual = Buffer.from(hashRevealShareToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function validateRevealShare(id: string, token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reveal_share_links")
    .select("id,project_id,token_hash,expires_at,revoked_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) return null;
  if (!tokenMatches(token, data.token_hash)) return null;
  return { id: data.id, projectId: data.project_id, expiresAt: new Date(data.expires_at) };
}

export async function getRevealShareAccess() {
  const value = (await cookies()).get(REVEAL_SHARE_COOKIE)?.value;
  if (!value) return null;
  const separator = value.indexOf(".");
  if (separator < 1) return null;
  return validateRevealShare(value.slice(0, separator), value.slice(separator + 1));
}
