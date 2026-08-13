import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  problem: z.string().trim().min(5).max(3000),
  page: z.string().trim().url().max(1000),
  website: z.string().max(0).optional().default("")
});

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please enter your name, a valid email, and a short description of the problem." }, { status: 400 });

    const apiKey = process.env.RESEND_API_KEY;
    const recipient = process.env.CONTRIBUTION_ALERT_EMAIL;
    if (!apiKey || !recipient) {
      console.error("help-request-email-not-configured");
      return NextResponse.json({ error: "Help messages are temporarily unavailable. Please try again shortly." }, { status: 503 });
    }

    const sender = process.env.CONTRIBUTION_ALERT_FROM || "Sandi 50th <uploads@sandi50th.com>";
    const { name, email, problem, page } = parsed.data;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        reply_to: email,
        subject: `Sandi50th help request from ${name}`,
        text: [`Name: ${name}`, `Contact email: ${email}`, `Page: ${page}`, "", problem].join("\n"),
        html: `<h2>Someone needs help with Sandi50th</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Contact email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p><p><strong>Page:</strong> ${escapeHtml(page)}</p><p style="white-space:pre-wrap">${escapeHtml(problem)}</p>`
      }),
      signal: AbortSignal.timeout(8_000)
    });

    if (!response.ok) {
      console.error("help-request-email", { status: response.status, detail: (await response.text()).slice(0, 300) });
      return NextResponse.json({ error: "Your message did not send. Please try once more." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("help-request", error);
    return NextResponse.json({ error: "Your message did not send. Please try once more." }, { status: 500 });
  }
}
