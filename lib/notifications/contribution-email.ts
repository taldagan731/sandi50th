type ContributionArrival = {
  submissionId: string;
  contributorName: string;
  relationship: string | null;
  prompt: string | null;
  lifeChapter: string | null;
  fileCount: number;
  receivedAt: string;
};

function contributionType(prompt: string | null) {
  if (prompt === "VOICE_WALL") return "voice recording";
  if (prompt === "BIRTHDAY_MESSAGE") return "birthday message";
  return "memory or archive contribution";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendContributionArrivalEmail(arrival: ContributionArrival) {
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.CONTRIBUTION_ALERT_EMAIL;
  if (!apiKey || !recipient) {
    return { sent: false, reason: "Contribution email is not configured." };
  }

  const sender = process.env.CONTRIBUTION_ALERT_FROM || "Sandi 50th <uploads@sandi50th.com>";
  const kind = contributionType(arrival.prompt);
  const name = arrival.contributorName || "A contributor";
  const detail = [
    arrival.relationship,
    arrival.lifeChapter,
    `${arrival.fileCount} file${arrival.fileCount === 1 ? "" : "s"}`
  ].filter(Boolean).join(" · ");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: sender,
      to: [recipient],
      subject: `New Sandi 50th ${kind} from ${name}`,
      text: [
        `${name} sent a new ${kind}.`,
        detail,
        `Received ${arrival.receivedAt}`,
        "Open Studio: https://www.sandi50th.com/studio"
      ].filter(Boolean).join("\n"),
      html: `<p><strong>${escapeHtml(name)}</strong> sent a new ${escapeHtml(kind)}.</p><p>${escapeHtml(detail)}</p><p>Received ${escapeHtml(arrival.receivedAt)}</p><p><a href="https://www.sandi50th.com/studio">Open Studio</a></p>`
    }),
    signal: AbortSignal.timeout(8_000)
  });

  if (!response.ok) {
    throw new Error(`Contribution email failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
  return { sent: true };
}
