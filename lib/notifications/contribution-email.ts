type ContributionArrivalArgs = {
  name: string;
  relationship: string | null;
  prompt: string | null;
  fileCount: number;
  submissionId: string;
};

function recipients() {
  return (process.env.CONTRIBUTION_ALERT_EMAIL || "")
    .split(/[;,]/)
    .map(value => value.trim())
    .filter(Boolean);
}

function subjectForPrompt(prompt: string | null) {
  if (prompt === "VOICE_WALL") return "New voice memory for Sandi";
  if (prompt === "BIRTHDAY_MESSAGE") return "New birthday message for Sandi";
  return "New contribution for Sandi";
}

function detailForPrompt(prompt: string | null, fileCount: number) {
  if (prompt === "VOICE_WALL") return "A new spoken memory has arrived.";
  if (prompt === "BIRTHDAY_MESSAGE") return "A new birthday message has arrived.";
  if (!fileCount) return "A new written contribution has arrived.";
  return `A new contribution with ${fileCount} file${fileCount === 1 ? "" : "s"} has arrived.`;
}

export async function sendContributionArrivalEmail(args: ContributionArrivalArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTRIBUTION_ALERT_FROM;
  const to = recipients();
  if (!apiKey || !from || !to.length) return;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: subjectForPrompt(args.prompt),
      text: [
        detailForPrompt(args.prompt, args.fileCount),
        "",
        `From: ${args.name}`,
        args.relationship ? `Relationship: ${args.relationship}` : "",
        `Files: ${args.fileCount}`,
        `Submission ID: ${args.submissionId}`
      ].filter(Boolean).join("\n"),
      html: [
        `<p>${detailForPrompt(args.prompt, args.fileCount)}</p>`,
        "<ul>",
        `<li><strong>From:</strong> ${escapeHtml(args.name)}</li>`,
        args.relationship ? `<li><strong>Relationship:</strong> ${escapeHtml(args.relationship)}</li>` : "",
        `<li><strong>Files:</strong> ${args.fileCount}</li>`,
        `<li><strong>Submission ID:</strong> ${escapeHtml(args.submissionId)}</li>`,
        "</ul>"
      ].join("")
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Resend rejected contribution alert: ${message}`);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
