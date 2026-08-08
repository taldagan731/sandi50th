import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearStudioSession,
  setStudioSession,
  verifyOwnerToken
} from "@/lib/studio/auth";

const schema = z.object({
  accessToken: z.string().min(20).max(5000),
  refreshToken: z.string().min(20).max(5000)
});

export async function POST(request: Request) {
  try {
    const { accessToken, refreshToken } = schema.parse(await request.json());
    const owner = await verifyOwnerToken(accessToken);
    if (!owner) {
      return NextResponse.json({ error: "This account is not authorized for the private studio." }, { status: 403 });
    }

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
