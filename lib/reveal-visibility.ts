import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_noStore as noStore } from "next/cache";

function revealColumnMissing(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42703" || /reveal_public/i.test(error.message ?? "")));
}

export async function getRevealProject() {
  noStore();
  const supabase = createAdminClient();
  const enriched = await supabase
    .from("projects")
    .select("id,reveal_public")
    .eq("slug", "sandi50th")
    .single();
  if (!enriched.error && enriched.data) {
    return { id: enriched.data.id, revealPublic: Boolean(enriched.data.reveal_public) };
  }
  if (!revealColumnMissing(enriched.error)) return null;

  const legacy = await supabase
    .from("projects")
    .select("id")
    .eq("slug", "sandi50th")
    .single();
  return legacy.error || !legacy.data ? null : { id: legacy.data.id, revealPublic: false };
}

export async function isRevealPublic() {
  return Boolean((await getRevealProject())?.revealPublic);
}