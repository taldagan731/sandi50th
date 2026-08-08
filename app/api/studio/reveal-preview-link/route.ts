import { NextResponse } from "next/server";
import { createRevealPreviewToken } from "@/lib/reveal-preview";
import { requireStudioOwner } from "@/lib/studio/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const owner = await requireStudioOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { expires, signature } = createRevealPreviewToken();
    const url = new URL("/api/reveal/owner-preview", request.url);
    url.searchParams.set("expires", String(expires));
    url.searchParams.set("signature", signature);
    url.searchParams.set("next", "/reveal");
    return NextResponse.json({ url: url.toString(), expiresAt: new Date(expires * 1000).toISOString() });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Private preview link could not be created."
    }, { status: 503 });
  }
}
