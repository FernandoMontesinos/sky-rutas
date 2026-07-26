"use server";

import { createClient } from "@/lib/supabase/server";

export type CambiarPasswordState = { error?: string; ok?: boolean };

/**
 * Cualquier usuario logueado puede cambiar su propia contraseña.
 * Pide la contraseña actual (no solo la nueva) y la valida re-autenticando
 * contra Supabase antes de aplicar el cambio — evita que alguien con la
 * sesión abierta en un celular prestado la cambie sin saber la actual.
 */
export async function cambiarPassword(
  _prev: CambiarPasswordState,
  formData: FormData
): Promise<CambiarPasswordState> {
  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");

  if (!actual || !nueva || !confirmar) {
    return { error: "Completa los 3 campos." };
  }
  if (nueva.length < 6) {
    return { error: "La contraseña nueva debe tener al menos 6 caracteres." };
  }
  if (nueva !== confirmar) {
    return { error: "La confirmación no coincide con la contraseña nueva." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "No se pudo identificar tu sesión. Vuelve a ingresar." };

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: actual,
  });
  if (authError) return { error: "La contraseña actual no es correcta." };

  const { error: updateError } = await supabase.auth.updateUser({ password: nueva });
  if (updateError) return { error: updateError.message };

  return { ok: true };
}
