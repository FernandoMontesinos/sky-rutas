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

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Error transitorio de la consulta (la red del celular se corta un
  // instante, cambio de WiFi a datos, timeout, RLS momentáneo): NO cerramos
  // la sesión. Antes esto caía en el mismo camino que "no hay perfil" y
  // disparaba signOut(), que revoca el refresh token y obliga a volver a
  // iniciar sesión sin motivo — la causa de que en el celular la sesión se
  // cerrara sola. Dejamos que la request falle y el usuario reintente con la
  // sesión intacta; en la siguiente carga el perfil se lee bien.
  if (error) {
    throw new Error("No se pudo cargar tu perfil, reintenta: " + error.message);
  }

  if (!profile) {
    // La consulta SÍ funcionó y confirmó que este usuario de auth no tiene
    // perfil (caso genuino y raro). Solo aquí tiene sentido desconectarlo.
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
