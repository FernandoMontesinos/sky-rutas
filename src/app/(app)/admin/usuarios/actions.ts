"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

export type FormResult = { error?: string; ok?: string };

const ROLES: UserRole[] = ["admin", "vendedor", "almacen", "repartidor", "facturacion"];

export async function createUser(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  await requireRole(["admin"]);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;

  if (!email || !full_name) return { error: "Nombre y correo son obligatorios." };
  if (password.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };
  if (!ROLES.includes(role)) return { error: "Selecciona un rol válido." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already"))
      return { error: "Ya existe un usuario con ese correo." };
    return { error: error.message };
  }

  revalidatePath("/admin/usuarios");
  return { ok: `Usuario ${full_name} creado.` };
}

/**
 * Corrige el nombre y/o el rol de un usuario ya creado (un apellido mal
 * escrito, alguien que cambia de puesto). El correo y la contraseña no se
 * tocan acá: viven en auth.users y cambiarlos es otra conversación.
 *
 * Usa el cliente de sesión, no service_role: la policy profiles_update_admin
 * (migración 31) ya expresa la regla en la base, así que esto funciona
 * aunque falte la variable de entorno de la clave de servicio.
 */
export async function actualizarUsuario(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  const { userId } = await requireRole(["admin"]);

  const id = String(formData.get("id") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as UserRole;

  if (!id) return { error: "Usuario inválido." };
  if (!full_name) return { error: "El nombre no puede quedar vacío." };
  if (!ROLES.includes(role)) return { error: "Selecciona un rol válido." };

  // No dejarse a uno mismo sin permisos: si el único admin se pasa a
  // vendedor, nadie puede volver a entrar a esta pantalla a arreglarlo.
  const supabase = await createClient();
  if (id === userId) {
    const { data: yo } = await supabase.from("profiles").select("role").eq("id", id).single();
    if (yo && yo.role !== role) {
      return { error: "No puedes cambiarte el rol a ti mismo; pídeselo a otro administrador." };
    }
  }

  // `.select()` a propósito: si RLS descarta la fila, PostgREST devuelve
  // cero filas SIN error y la pantalla diría que guardó algo que no guardó.
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name, role })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "No se pudo guardar (sin permiso sobre ese usuario)." };

  revalidatePath("/admin/usuarios");
  return { ok: `${full_name} actualizado.` };
}

export async function toggleActivo(formData: FormData): Promise<void> {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  const activo = String(formData.get("activo") ?? "") === "true";
  if (!id) return;

  const admin = createAdminClient();
  await admin.from("profiles").update({ activo: !activo }).eq("id", id);
  revalidatePath("/admin/usuarios");
}

export async function deleteUser(formData: FormData): Promise<void> {
  const { userId } = await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!id || id === userId) return; // no te elimines a ti mismo

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(id);
  revalidatePath("/admin/usuarios");
}
