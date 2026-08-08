import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const STUDIO_COOKIE = "sandi-studio-token";
export const STUDIO_REFRESH_COOKIE = "sandi-studio-refresh";
const STUDIO_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: STUDIO_SESSION_MAX_AGE,
    ...(process.env.VERCEL_ENV === "production" ? { domain: ".sandi50th.com" } : {})
  };
}

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

export async function setStudioSession(accessToken: string, refreshToken: string) {
  const store = await cookies();
  const options = cookieOptions();
  store.set(STUDIO_COOKIE, accessToken, options);
  store.set(STUDIO_REFRESH_COOKIE, refreshToken, options);
}

export async function clearStudioSession() {
  const store = await cookies();
  const options = cookieOptions();
  store.set(STUDIO_COOKIE, "", { ...options, maxAge: 0 });
  store.set(STUDIO_REFRESH_COOKIE, "", { ...options, maxAge: 0 });
}

export async function requireStudioOwner() {
  const store = await cookies();
  const accessToken = store.get(STUDIO_COOKIE)?.value;
  if (accessToken) {
    const owner = await verifyOwnerToken(accessToken);
    if (owner) return owner;
  }

  const refreshToken = store.get(STUDIO_REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return null;

  const owner = await verifyOwnerToken(data.session.access_token);
  if (!owner) return null;

  await setStudioSession(data.session.access_token, data.session.refresh_token);
  return owner;
}
