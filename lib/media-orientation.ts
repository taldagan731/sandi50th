import sharp from "sharp";

export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

function readExifTiffOrientation(buffer: Buffer): ExifOrientation | null {
  const marker = Buffer.from("Exif\0\0", "binary");
  let searchFrom = 0;
  while (searchFrom < buffer.length) {
    const markerIndex = buffer.indexOf(marker, searchFrom);
    if (markerIndex < 0) return null;
    const tiff = markerIndex + marker.length;
    try {
      const order = buffer.toString("ascii", tiff, tiff + 2);
      const little = order === "II";
      if (!little && order !== "MM") throw new Error("Invalid TIFF byte order");
      const read16 = (offset: number) => little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
      const read32 = (offset: number) => little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
      if (read16(tiff + 2) !== 42) throw new Error("Invalid TIFF marker");
      const ifd = tiff + read32(tiff + 4);
      const entries = read16(ifd);
      for (let index = 0; index < entries; index += 1) {
        const entry = ifd + 2 + index * 12;
        if (read16(entry) !== 0x0112) continue;
        const orientation = read16(entry + 8);
        return orientation >= 1 && orientation <= 8 ? orientation as ExifOrientation : null;
      }
    } catch {
      // HEIF containers can contain several metadata blocks. Continue searching.
    }
    searchFrom = markerIndex + marker.length;
  }
  return null;
}

export async function detectOriginalOrientation(buffer: Buffer): Promise<ExifOrientation> {
  try {
    const metadata = await sharp(buffer, { failOn: "none", limitInputPixels: 120_000_000 }).metadata();
    if (metadata.orientation && metadata.orientation >= 1 && metadata.orientation <= 8) return metadata.orientation as ExifOrientation;
  } catch {
    // Sharp may not decode HEIC in every deployment; the TIFF parser below does not decode pixels.
  }
  return readExifTiffOrientation(buffer) ?? 1;
}

export function manualRotationFromNotes(notes: string | null | undefined) {
  const match = String(notes ?? "").match(/\[presentation-rotation:(0|90|180|270)\]/);
  return match ? Number(match[1]) : 0;
}

export function notesWithManualRotation(notes: string | null | undefined, rotation: number) {
  const normalized = ((rotation % 360) + 360) % 360;
  const clean = String(notes ?? "").replace(/\s*\[presentation-rotation:(?:0|90|180|270)\]/g, "").trim();
  return [clean, normalized ? `[presentation-rotation:${normalized}]` : ""].filter(Boolean).join("\n");
}
