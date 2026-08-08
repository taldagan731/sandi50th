import { head } from "@vercel/blob";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function readPrivateMedia(
  supabase: SupabaseClient,
  storagePath: string
): Promise<Buffer> {
  if (storagePath.startsWith("incoming/") || storagePath.startsWith("posters/")) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("Vercel Blob is not configured.");
    const blob = await head(storagePath);
    const response = await fetch(blob.url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Could not read private media (${response.status}).`);
    return Buffer.from(await response.arrayBuffer());
  }

  const { data, error } = await supabase.storage
    .from("sandi-memories")
    .createSignedUrl(storagePath, 120);
  if (error || !data) throw new Error("Could not read legacy private media.");
  const response = await fetch(data.signedUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not read legacy media (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}
