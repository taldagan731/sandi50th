import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    release: "august-11-reveal",
    commit: process.env.VERCEL_GIT_COMMIT_SHA || "local-development",
    contributionStorage: "supabase-records-private-vercel-blob-media"
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
