import { createHash } from "node:crypto";
import { get, head, list, put } from "@vercel/blob";

function markerPath(sha256) {
  return `dedupe/sha256/${sha256}.json`;
}

async function markerExists(pathname) {
  try {
    await head(pathname);
    return true;
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status === 404 || /not.?found/i.test(String(error?.message || ""))) return false;
    throw error;
  }
}

const all = [];
let cursor;
do {
  const page = await list({ prefix: "incoming/", cursor, limit: 1000 });
  all.push(...page.blobs);
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);

const images = all.filter(blob => /\.(?:jpe?g|png|webp|gif|heic|heif)$/i.test(blob.pathname));
const firstByHash = new Map();
const duplicates = [];
let indexed = 0;

for (const [index, blob] of images.entries()) {
  const response = await get(blob.pathname, { access: "private" });
  if (!response) throw new Error(`Could not read ${blob.pathname}`);
  const sha256 = createHash("sha256").update(Buffer.from(await new Response(response.stream).arrayBuffer())).digest("hex");
  const first = firstByHash.get(sha256);
  if (first) {
    duplicates.push({ sha256, first, duplicate: blob.pathname });
  } else {
    firstByHash.set(sha256, blob.pathname);
  }

  const pathname = markerPath(sha256);
  if (!await markerExists(pathname)) {
    await put(pathname, JSON.stringify({
      version: 1,
      sha256,
      submissionId: blob.pathname.split("/")[1] || "existing",
      pathname: first || blob.pathname,
      originalName: blob.pathname.split("/").at(-1) || "existing-photo",
      bytes: blob.size,
      recordedAt: new Date().toISOString(),
      source: "existing-library-backfill"
    }), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: false
    });
    indexed += 1;
  }

  if ((index + 1) % 25 === 0) {
    console.log(`Indexed ${index + 1}/${images.length} existing photographs`);
  }
}

console.log(JSON.stringify({
  incomingObjects: all.length,
  imageObjects: images.length,
  uniqueHashes: firstByHash.size,
  markersCreated: indexed,
  exactDuplicateObjectsFound: duplicates.length,
  duplicatePaths: duplicates
}, null, 2));
