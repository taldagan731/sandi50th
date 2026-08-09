import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const REVEAL_PREVIEW_COOKIE = "sandi-reveal-preview";
export const REVEAL_PREVIEW_DAYS = 7;
export const OWNER_INVITATION_EXPIRES = 1786852800;
const OWNER_INVITATION_HASH = "b5641ae5182d6d5d9b72189fc402268c48aad9e165dc3689b451d7caf2b01e88";

function signingSecret() {
  return process.env.OWNER_PREVIEW_SECRET || process.env.CRON_SECRET || "";
}

function signatureFor(expires: number) {
  return createHmac("sha256", signingSecret())
    .update(`sandi50th:reveal-preview:${expires}`)
    .digest("base64url");
}

export function createRevealPreviewToken(expires = Math.floor(Date.now() / 1000) + REVEAL_PREVIEW_DAYS * 86400) {
  if (!signingSecret()) throw new Error("OWNER_PREVIEW_SECRET or CRON_SECRET is required.");
  return { expires, signature: signatureFor(expires) };
}

export function verifyRevealPreviewToken(expiresValue: string | null | undefined, supplied: string | null | undefined) {
  if (!signingSecret() || !expiresValue || !supplied) return false;
  const expires = Number(expiresValue);
  if (!Number.isInteger(expires) || expires <= Math.floor(Date.now() / 1000)) return false;
  const expected = signatureFor(expires);
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyOwnerInvitation(supplied: string | null | undefined) {
  if (!supplied || Math.floor(Date.now() / 1000) >= OWNER_INVITATION_EXPIRES) return false;
  const digest = createHash("sha256").update(supplied).digest("hex");
  const left = Buffer.from(OWNER_INVITATION_HASH);
  const right = Buffer.from(digest);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function revealPreviewCookieOptions(maxAge = REVEAL_PREVIEW_DAYS * 86400) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    ...(process.env.VERCEL_ENV === "production" ? { domain: ".sandi50th.com" } : {})
  };
}

export async function hasRevealPreviewAccess() {
  const value = (await cookies()).get(REVEAL_PREVIEW_COOKIE)?.value;
  if (!value) return false;
  if (value.startsWith("invite.")) return verifyOwnerInvitation(value.slice("invite.".length));
  const separator = value.indexOf(".");
  if (separator < 1) return false;
  return verifyRevealPreviewToken(value.slice(0, separator), value.slice(separator + 1));
}