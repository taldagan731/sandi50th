import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    release: "private-story-studio-v1",
    contributionStorage: "supabase-records-private-vercel-blob-media"
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
