import { cookies } from "next/headers";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRevealPreviewAccess } from "@/lib/reveal-preview";

export const STUDIO_COOKIE = "sandi-studio-token";
export const STUDIO_REFRESH_COOKIE = "sandi-studio-refresh";
export const STUDIO_PASSPHRASE_COOKIE = "sandi-studio-passphrase";
const STUDIO_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const STUDIO_PASSPHRASE_SALT = "sandi50th-studio-passphrase-v1";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: STUDIO_SESSION_MAX_AGE,
    ...(process.env.VERCEL_ENV === "production" ? { domain: ".sandi50th.com" } : {})
  };
}

function studioPassphraseHash() {
  return process.env.STUDIO_PASSPHRASE_HASH?.trim() || "";
}

function studioSessionSecret() {
  return process.env.STUDIO_SESSION_SECRET?.trim() || "";
}

async function resolveStudioProjectOwner() {
  const supabase = createAdminClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, title")
    .eq("slug", "sandi50th")
    .single();
  if (projectError || !project) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", project.id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) return null;

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(membership.user_id);
  if (userError || !userData.user) return null;
  return { user: userData.user, project, supabase };
}

function hashStudioPassphrase(passphrase: string) {
  return scryptSync(passphrase, STUDIO_PASSPHRASE_SALT, 32).toString("hex");
}

function signedStudioPassphraseValue() {
  const secret = studioSessionSecret();
  if (!secret) return null;

  const expiresAt = Date.now() + STUDIO_SESSION_MAX_AGE * 1000;
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt }), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function hasValidStudioPassphraseSession(cookieValue?: string) {
  const secret = studioSessionSecret();
  if (!cookieValue || !secret) return false;

  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = createHmac("sha256", secret).update(payload).digest("base64url");
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export function studioPassphraseAuthConfigured() {
  return Boolean(studioPassphraseHash() && studioSessionSecret());
}

export function verifyStudioPassphrase(passphrase: string) {
  const expectedHash = studioPassphraseHash();
  if (!expectedHash) return false;

  const provided = Buffer.from(hashStudioPassphrase(passphrase), "utf8");
  const expected = Buffer.from(expectedHash, "utf8");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function verifyOwnerToken(token: string) {
  const supabase = createAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, title")
    .eq("slug", "sandi50th")
    .single();
  if (projectError || !project) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", project.id)
    .eq("user_id", userData.user.id)
    .eq("role", "owner")
    .maybeSingle();
  if (membershipError || !membership) return null;

  return { user: userData.user, project, supabase };
}

export async function setStudioSession(accessToken: string, refreshToken: string) {
  const store = await cookies();
  const options = cookieOptions();
  store.set(STUDIO_COOKIE, accessToken, options);
  store.set(STUDIO_REFRESH_COOKIE, refreshToken, options);
}

export async function setStudioPassphraseSession() {
  const value = signedStudioPassphraseValue();
  if (!value) throw new Error("Studio passphrase auth is not configured.");

  const store = await cookies();
  store.set(STUDIO_PASSPHRASE_COOKIE, value, cookieOptions());
}

export async function clearStudioSession() {
  const store = await cookies();
  const options = cookieOptions();
  store.set(STUDIO_COOKIE, "", { ...options, maxAge: 0 });
  store.set(STUDIO_REFRESH_COOKIE, "", { ...options, maxAge: 0 });
  store.set(STUDIO_PASSPHRASE_COOKIE, "", { ...options, maxAge: 0 });
}

export async function requireStudioOwner() {
  const store = await cookies();
  const accessToken = store.get(STUDIO_COOKIE)?.value;
  if (accessToken) {
    const owner = await verifyOwnerToken(accessToken);
    if (owner) return owner;
  }

  const refreshToken = store.get(STUDIO_REFRESH_COOKIE)?.value;
  if (refreshToken) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (!error && data.session) {
      const owner = await verifyOwnerToken(data.session.access_token);
      if (owner) {
        await setStudioSession(data.session.access_token, data.session.refresh_token);
        return owner;
      }
    }
  }

  const passphraseSession = store.get(STUDIO_PASSPHRASE_COOKIE)?.value;
  if (hasValidStudioPassphraseSession(passphraseSession)) {
    return resolveStudioProjectOwner();
  }

  return null;
}

/**
 * Allows the owner's existing signed preview invitation to open Studio without
 * a Supabase password. Guest reveal-share links do not qualify. The real owner
 * membership is still resolved so edits retain the correct audit identity.
 */
export async function requireStudioAccess() {
  const signedInOwner = await requireStudioOwner();
  if (signedInOwner) return signedInOwner;

  // Temporary launch-week bypass explicitly approved by the owner. It closes
  // automatically after Wednesday night unless production sets another time.
  const bypassUntil = Date.parse(process.env.STUDIO_BYPASS_UNTIL || "2026-08-13T03:59:00.000Z");
  const temporaryBypassActive = Number.isFinite(bypassUntil) && Date.now() < bypassUntil;
  if (!temporaryBypassActive && !await hasRevealPreviewAccess()) return null;

  return resolveStudioProjectOwner();
}