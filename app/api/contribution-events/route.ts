import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const eventSchema = z.object({
  attemptId: z.string().uuid(),
  path: z.enum(["memory", "photos", "voice", "birthday"]),
  step: z.number().int().min(0).max(4),
  event: z.enum(["selected", "step", "completed"])
});

export async function POST(request: Request) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  console.info("contribution-flow", parsed.data);
  return NextResponse.json({ ok: true });
}
