import { NextResponse } from "next/server";
import { z } from "zod";
import {
  chapterNineRateLimitState,
  clearChapterNineSessionCookie,
  recordChapterNineAuthAttempt,
  setChapterNineSessionCookie,
  verifyChapterNinePassphrase
} from "@/lib/chapter-nine";

const schema = z.object({
  passphrase: z.string().trim().min(1).max(200)
});

export async function POST(request: Request) {
  try {
    const { passphrase } = schema.parse(await request.json());
    const rateLimit = await chapterNineRateLimitState(request);
    if (rateLimit.blocked) {
      return NextResponse.json({
        error: "Too many attempts. Please wait before trying again.",
        retryAfter: rateLimit.retryAfterSeconds
      }, { status: 429 });
    }

    const allowed = await verifyChapterNinePassphrase(passphrase);
    await recordChapterNineAuthAttempt(rateLimit, allowed);
    if (!allowed) {
      return NextResponse.json({ error: "That passphrase is not correct." }, { status: 403 });
    }

    await setChapterNineSessionCookie();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Chapter Nine could not be opened." }, { status: 400 });
  }
}

export async function DELETE() {
  await clearChapterNineSessionCookie();
  return NextResponse.json({ ok: true });
}