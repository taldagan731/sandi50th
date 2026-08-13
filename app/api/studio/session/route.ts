import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  clearStudioSession,
  setStudioPassphraseSession,
  setStudioSession,
  studioPassphraseAuthConfigured,
  verifyOwnerToken,
  verifyStudioPassphrase
} from "@/lib/studio/auth";

const ownerSessionSchema = z.object({
  accessToken: z.string().min(20).max(5000),
  refreshToken: z.string().min(20).max(5000)
});

const passphraseSchema = z.object({
  passphrase: z.string().trim().min(1).max(200)
});

const MAX_FAILED_ATTEMPTS = 8;
const FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function rateLimitKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent")?.slice(0, 120) || "unknown";
  return `${forwardedFor}:${userAgent}`;
}

function currentAttemptWindow(key: string) {
  const now = Date.now();
  const existing = failedAttempts.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + FAILED_ATTEMPT_WINDOW_MS };
    failedAttempts.set(key, fresh);
    return fresh;
  }
  return existing;
}

function registerFailure(key: string) {
  const state = currentAttemptWindow(key);
  state.count += 1;
}

function clearFailures(key: string) {
  failedAttempts.delete(key);
}

function isRateLimited(key: string) {
  return currentAttemptWindow(key).count >= MAX_FAILED_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  const key = rateLimitKey(request);
  if (isRateLimited(key)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a little while and try again." }, { status: 429 });
  }

  try {
    const payload = await request.json();
    const passphraseResult = passphraseSchema.safeParse(payload);
    if (passphraseResult.success) {
      if (!studioPassphraseAuthConfigured()) {
        return NextResponse.json({ error: "Studio passphrase access is not configured yet." }, { status: 503 });
      }

      if (!verifyStudioPassphrase(passphraseResult.data.passphrase)) {
        registerFailure(key);
        return NextResponse.json({ error: "That passphrase was not accepted." }, { status: 403 });
      }

      clearFailures(key);
      await clearStudioSession();
      await setStudioPassphraseSession();
      return NextResponse.json({ ok: true, mode: "passphrase" });
    }

    const { accessToken, refreshToken } = ownerSessionSchema.parse(payload);
    const owner = await verifyOwnerToken(accessToken);
    if (!owner) {
      registerFailure(key);
      return NextResponse.json({ error: "This account is not authorized for the private studio." }, { status: 403 });
    }

    clearFailures(key);
    await clearStudioSession();
    await setStudioSession(accessToken, refreshToken);
    return NextResponse.json({ ok: true, email: owner.user.email });
  } catch {
    return NextResponse.json({ error: "Sign-in could not be completed." }, { status: 400 });
  }
}

export async function DELETE() {
  await clearStudioSession();
  return NextResponse.json({ ok: true });
}