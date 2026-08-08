import { head, put } from "@vercel/blob";

export const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function dedupeMarkerPath(sha256: string) {
  if (!SHA256_PATTERN.test(sha256)) throw new Error("Invalid SHA-256 digest.");
  return `dedupe/sha256/${sha256}.json`;
}

export async function duplicateMarkerExists(sha256: string) {
  try {
    const marker = await head(dedupeMarkerPath(sha256));
    return marker.size > 0;
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : 0;
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : "";
    if (status === 404 || /not.?found/i.test(name) || /not.?found/i.test(message)) return false;
    throw error;
  }
}

export async function writeDuplicateMarker(input: {
  sha256: string;
  submissionId: string;
  pathname: string;
  originalName: string;
  bytes: number;
}) {
  await put(dedupeMarkerPath(input.sha256), JSON.stringify({
    version: 1,
    sha256: input.sha256,
    submissionId: input.submissionId,
    pathname: input.pathname,
    originalName: input.originalName,
    bytes: input.bytes,
    recordedAt: new Date().toISOString()
  }), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: false
  });
}
