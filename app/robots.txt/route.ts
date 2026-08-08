import { NextResponse } from "next/server";
import { isRevealPublic } from "@/lib/reveal-visibility";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const publicReveal = await isRevealPublic();
  const body = publicReveal
    ? "User-agent: *\nAllow: /\nDisallow: /studio\nDisallow: /api/\n"
    : "User-agent: *\nDisallow: /\n";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0"
    }
  });
}
