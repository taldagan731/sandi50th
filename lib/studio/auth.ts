import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const STUDIO_COOKIE = "sandi-studio-token";

export async function verifyOwnerToken(token: string) {
  const supabase = createAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, title")
    .eq("slug", "sandi50th")
    .single();
  if (projectError || !project) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", project.id)
    .eq("user_id", userData.user.id)
    .eq("role", "owner")
    .maybeSingle();
  if (membershipError || !membership) return null;

  return { user: userData.user, project, supabase };
}

export async function requireStudioOwner() {
  const store = await cookies();
  const token = store.get(STUDIO_COOKIE)?.value;
  if (!token) return null;
  return verifyOwnerToken(token);
}
