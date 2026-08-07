import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { STUDIO_COOKIE, verifyOwnerToken } from "@/lib/studio/auth";

const schema = z.object({ accessToken: z.string().min(20).max(5000) });

export async function POST(request: Request) {
  try {
    const { accessToken } = schema.parse(await request.json());
    const owner = await verifyOwnerToken(accessToken);
    if (!owner) {
      return NextResponse.json({ error: "This account is not authorized for the private studio." }, { status: 403 });
    }

    const store = await cookies();
    store.set(STUDIO_COOKIE, accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60
    });
    return NextResponse.json({ ok: true, email: owner.user.email });
  } catch {
    return NextResponse.json({ error: "Sign-in could not be completed." }, { status: 400 });
  }
}

export async function DELETE() {
  const store = await cookies();
  store.delete(STUDIO_COOKIE);
  return NextResponse.json({ ok: true });
}
