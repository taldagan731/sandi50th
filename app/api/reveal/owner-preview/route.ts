import { NextResponse } from "next/server";
import {
  REVEAL_PREVIEW_COOKIE,
  revealPreviewCookieOptions,
  verifyRevealPreviewToken
} from "@/lib/reveal-preview";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const expires = url.searchParams.get("expires");
  const signature = url.searchParams.get("signature");
  if (!verifyRevealPreviewToken(expires, signature)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const requestedNext = url.searchParams.get("next") || "/reveal";
  const next = requestedNext === "/reveal" || requestedNext.startsWith("/reveal?")
    ? requestedNext
    : "/reveal";
  const maxAge = Math.max(1, Number(expires) - Math.floor(Date.now() / 1000));
  const response = NextResponse.redirect(new URL(next, url.origin));
  response.cookies.set(REVEAL_PREVIEW_COOKIE, `${expires}.${signature}`, revealPreviewCookieOptions(maxAge));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
