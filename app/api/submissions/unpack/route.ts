import { get, put, type PutBlobResult } from "@vercel/blob";
import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ZIP_BYTES = 350 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 1500 * 1024 * 1024;
const MAX_ENTRIES = 500;
const MAX_ENTRY_BYTES = 500 * 1024 * 1024;

const schema = z.object({
  submissionId: z.string().uuid(),
  pathname: z.string().min(1).max(900),
  originalName: z.string().min(1).max(500)
});

type ZipEntry = {
  name: string;
  method: number;
  flags: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  mp3: "audio/mpeg", m4a: "audio/x-m4a", wav: "audio/wav", ogg: "audio/ogg",
  pdf: "application/pdf"
};

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const expectedPrefix = `incoming/${body.submissionId}/`;
    if (!body.pathname.startsWith(expectedPrefix) || !/\.zip$/i.test(body.originalName)) {
      return NextResponse.json({ error: "Invalid archive path." }, { status: 400 });
    }

    const stored = await get(body.pathname, { access: "private", useCache: false });
    if (!stored || stored.statusCode !== 200) {
      return NextResponse.json({ error: "The ZIP archive could not be read." }, { status: 404 });
    }
    if (stored.blob.size > MAX_ZIP_BYTES) {
      return NextResponse.json({
        error: "The ZIP arrived safely, but it is too large to sort automatically. We will unpack it during review."
      }, { status: 202 });
    }

    const bytes = Buffer.from(await new Response(stored.stream).arrayBuffer());
    const entries = readCentralDirectory(bytes);
    if (entries.length > MAX_ENTRIES) {
      return NextResponse.json({
        error: `The ZIP arrived safely, but contains more than ${MAX_ENTRIES} files. We will unpack it during review.`
      }, { status: 202 });
    }

    const useful = entries.filter(entry => {
      const normalized = normalizeArchivePath(entry.name);
      if (!normalized || normalized.endsWith("/")) return false;
      const parts = normalized.split("/");
      const base = parts.at(-1) || "";
      if (parts.includes("__MACOSX") || base === ".DS_Store" || base.startsWith("._")) return false;
      const extension = base.split(".").pop()?.toLowerCase() || "";
      return Boolean(MIME_BY_EXTENSION[extension]);
    });

    const totalExpanded = useful.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
    if (totalExpanded > MAX_EXPANDED_BYTES || useful.some(entry => entry.uncompressedSize > MAX_ENTRY_BYTES)) {
      return NextResponse.json({
        error: "The ZIP arrived safely, but its expanded contents are too large to sort automatically. We will unpack it during review."
      }, { status: 202 });
    }

    const extracted: Array<PutBlobResult & { originalName: string; bytes: number; sha256?: string }> = [];
    for (const [index, entry] of useful.entries()) {
      const fileBytes = extractEntry(bytes, entry);
      const normalized = normalizeArchivePath(entry.name);
      const base = normalized.split("/").pop() || `archive-item-${index + 1}`;
      const extension = base.split(".").pop()?.toLowerCase() || "";
      const contentType = MIME_BY_EXTENSION[extension];
      const pathname = `${expectedPrefix}unpacked/${String(index + 1).padStart(3, "0")}-${crypto.randomUUID()}-${safeName(base)}`;
      const result = await put(pathname, fileBytes, {
        access: "private",
        contentType,
        addRandomSuffix: false,
        allowOverwrite: false
      });
      const sha256 = contentType.startsWith("image/") ? createHash("sha256").update(fileBytes).digest("hex") : undefined;
      extracted.push({ ...result, originalName: base, bytes: fileBytes.length, sha256 });
    }

    return NextResponse.json({
      ok: true,
      archive: body.originalName,
      extracted,
      ignoredCount: entries.length - useful.length
    });
  } catch (error) {
    console.error("archive-unpack", error);
    return NextResponse.json({
      error: "The ZIP arrived safely, but automatic sorting did not finish. The original archive remains preserved for review."
    }, { status: 202 });
  }
}

function readCentralDirectory(buffer: Buffer): ZipEntry[] {
  const minimum = Math.max(0, buffer.length - 65_557);
  let eocd = -1;
  for (let index = buffer.length - 22; index >= minimum; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP end record not found.");

  const count = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  if (count === 0xffff || centralOffset === 0xffffffff || centralSize === 0xffffffff) {
    throw new Error("ZIP64 archives are preserved but not expanded automatically.");
  }

  const decoder = new TextDecoder("utf-8");
  const entries: ZipEntry[] = [];
  let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Invalid central directory.");
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = decoder.decode(buffer.subarray(cursor + 46, cursor + 46 + nameLength));
    entries.push({ name, method, flags, compressedSize, uncompressedSize, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function extractEntry(buffer: Buffer, entry: ZipEntry) {
  if (entry.flags & 0x1) throw new Error("Encrypted ZIP entries are not supported.");
  if (buffer.readUInt32LE(entry.localOffset) !== 0x04034b50) throw new Error("Invalid local ZIP entry.");
  const nameLength = buffer.readUInt16LE(entry.localOffset + 26);
  const extraLength = buffer.readUInt16LE(entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(start, start + entry.compressedSize);
  let output: Buffer;
  if (entry.method === 0) output = Buffer.from(compressed);
  else if (entry.method === 8) output = inflateRawSync(compressed);
  else throw new Error(`Unsupported ZIP compression method ${entry.method}.`);
  if (output.length !== entry.uncompressedSize) throw new Error("Expanded ZIP entry size mismatch.");
  return output;
}

function normalizeArchivePath(name: string) {
  const normalized = name.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.split("/").some(part => part === "..")) return "";
  return normalized;
}

function safeName(name: string) {
  const dot = name.lastIndexOf(".");
  const extension = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
  const stem = (dot >= 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "archive-item";
  return `${stem}${extension.slice(0, 16)}`;
}
