import { NextResponse } from "next/server";
import {
  OWNER_INVITATION_EXPIRES,
  REVEAL_PREVIEW_COOKIE,
  revealPreviewCookieOptions,
  verifyOwnerInvitation,
  verifyRevealPreviewToken
} from "@/lib/reveal-preview";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const expires = url.searchParams.get("expires");
  const signature = url.searchParams.get("signature");
  const invited = verifyOwnerInvitation(url.searchParams.get("access"));
  const signed = verifyRevealPreviewToken(expires, signature);
  if (!invited && !signed) return new NextResponse("Not found", { status: 404 });

  const cookieValue = invited
    ? `invite.${url.searchParams.get("access")}`
    : `${expires}.${signature}`;
  const cookieExpires = invited ? OWNER_INVITATION_EXPIRES : Number(expires);
  const requestedNext = url.searchParams.get("next") || "/reveal";
  const next = requestedNext === "/shader-preview" || requestedNext === "/reveal" || requestedNext.startsWith("/reveal?")
    ? requestedNext
    : "/reveal";
  const maxAge = Math.max(1, cookieExpires - Math.floor(Date.now() / 1000));
  const response = NextResponse.redirect(new URL(next, url.origin));
  response.cookies.set(REVEAL_PREVIEW_COOKIE, cookieValue, revealPreviewCookieOptions(maxAge));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}