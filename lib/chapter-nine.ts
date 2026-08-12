import { cookies } from "next/headers";
import { createHash, createHmac, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const CHAPTER_NINE_COOKIE = "chapter-nine-session";
export const CHAPTER_NINE_PROMPT = "CHAPTER_NINE";
export const CHAPTER_NINE_AUTHOR = "Sandi";
export const CHAPTER_NINE_RELATIONSHIP = "Self";
export const CHAPTER_NINE_LABEL = "Chapter Nine";

const CHAPTER_NINE_RATE_COOKIE = "chapter-nine-rate";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_BLOCK_MS = 60 * 60 * 1000;

type ChapterNineSession = {
  scope: "chapter-nine";
  nonce: string;
  exp: number;
};

type ChapterNineRateState = {
  scope: "chapter-nine-rate";
  fingerprint: string;
  failures: number[];
  blockedUntil: number;
  exp: number;
};

function sessionSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Supabase server credentials are not configured.");
  return secret;
}

function configuredPassphrase() {
  const passphrase = process.env.CHAPTER_NINE_PASSPHRASE;
  if (!passphrase) throw new Error("CHAPTER_NINE_PASSPHRASE is not configured.");
  return passphrase;
}

function derivePassphrase(passphrase: string) {
  const salt = createHash("sha256").update("chapter-nine-passphrase").update(sessionSecret()).digest();
  return scryptSync(passphrase, salt, 32);
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function encodeSigned(payload: ChapterNineSession | ChapterNineRateState) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${value}.${sign(value)}`;
}

function decodeSigned<T extends { scope: string; exp: number }>(value: string | undefined, scope: T["scope"]) {
  if (!value) return null;
  const split = value.lastIndexOf(".");
  if (split <= 0) return null;

  const encoded = value.slice(0, split);
  const signature = value.slice(split + 1);
  if (sign(encoded) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
    if (payload.scope !== scope || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function fingerprintForRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return createHash("sha256")
    .update("chapter-nine-rate-limit")
    .update(sessionSecret())
    .update(forwarded)
    .update(userAgent)
    .digest("hex");
}

async function projectId() {
  const supabase = createAdminClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", "sandi50th")
    .single();
  if (error || !project) throw error ?? new Error("Project not found.");
  return project.id;
}

async function persistRateLimitState(state: { fingerprint: string; failures: number[]; blockedUntil: number } | null) {
  const store = await cookies();
  if (!state || (!state.failures.length && !state.blockedUntil)) {
    store.delete(CHAPTER_NINE_RATE_COOKIE);
    return;
  }

  const lifetimeMs = Math.max(
    state.blockedUntil ? state.blockedUntil - Date.now() : 0,
    RATE_LIMIT_WINDOW_MS
  );
  store.set(CHAPTER_NINE_RATE_COOKIE, encodeSigned({
    scope: "chapter-nine-rate",
    fingerprint: state.fingerprint,
    failures: state.failures,
    blockedUntil: state.blockedUntil,
    exp: Date.now() + lifetimeMs
  }), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: Math.max(60, Math.ceil(lifetimeMs / 1000))
  });
}

export async function verifyChapterNinePassphrase(candidate: string) {
  const expected = derivePassphrase(configuredPassphrase());
  const actual = derivePassphrase(candidate);
  return timingSafeEqual(expected, actual);
}

export async function getChapterNineSession() {
  const store = await cookies();
  return decodeSigned<ChapterNineSession>(store.get(CHAPTER_NINE_COOKIE)?.value, "chapter-nine");
}

export async function requireChapterNineSession() {
  const session = await getChapterNineSession();
  return session ? { projectId: await projectId(), session } : null;
}

export async function setChapterNineSessionCookie() {
  const store = await cookies();
  store.set(CHAPTER_NINE_COOKIE, encodeSigned({
    scope: "chapter-nine",
    nonce: randomUUID(),
    exp: Date.now() + SESSION_TTL_SECONDS * 1000
  }), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function clearChapterNineSessionCookie() {
  const store = await cookies();
  store.delete(CHAPTER_NINE_COOKIE);
}

export async function chapterNineRateLimitState(request: Request) {
  const store = await cookies();
  const fingerprint = fingerprintForRequest(request);
  const payload = decodeSigned<ChapterNineRateState>(store.get(CHAPTER_NINE_RATE_COOKIE)?.value, "chapter-nine-rate");
  const now = Date.now();

  if (!payload || payload.fingerprint !== fingerprint) {
    return {
      fingerprint,
      blocked: false,
      retryAfterSeconds: 0,
      failures: [] as number[]
    };
  }

  const failures = payload.failures.filter(timestamp => now - timestamp <= RATE_LIMIT_WINDOW_MS);
  const blockedUntil = payload.blockedUntil > now ? payload.blockedUntil : 0;
  return {
    fingerprint,
    blocked: blockedUntil > now,
    retryAfterSeconds: blockedUntil > now ? Math.ceil((blockedUntil - now) / 1000) : 0,
    failures
  };
}

export async function recordChapterNineAuthAttempt(
  state: { fingerprint: string; failures: number[] },
  success: boolean
) {
  if (success) {
    await persistRateLimitState(null);
    return;
  }

  const now = Date.now();
  const failures = [...state.failures.filter(timestamp => now - timestamp <= RATE_LIMIT_WINDOW_MS), now];
  const blockedUntil = failures.length >= RATE_LIMIT_MAX_ATTEMPTS ? now + RATE_LIMIT_BLOCK_MS : 0;
  await persistRateLimitState({
    fingerprint: state.fingerprint,
    failures,
    blockedUntil
  });
}

export async function chapterNineSubmissionIds(projectId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("id")
    .eq("project_id", projectId)
    .eq("prompt", CHAPTER_NINE_PROMPT)
    .neq("review_status", "excluded")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(item => item.id);
}