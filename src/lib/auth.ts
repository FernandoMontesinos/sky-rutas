import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

/**
 * Devuelve el usuario autenticado y su perfil. Si no hay sesión, redirige a /login.
 * Úsalo al inicio de cada página protegida.
 */
export async function requireUser(): Promise<{ userId: string; profile: Profile }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Usuario de auth sin perfil: lo desconectamos para evitar estados raros.
    await supabase.auth.signOut();
    redirect("/login");
  }

  return { userId: user.id, profile: profile as Profile };
}

/** Igual que requireUser pero además exige uno de los roles permitidos. */
export async function requireRole(
  roles: UserRole[]
): Promise<{ userId: string; profile: Profile }> {
  const { userId, profile } = await requireUser();
  if (!roles.includes(profile.role)) redirect("/");
  return { userId, profile };
}
