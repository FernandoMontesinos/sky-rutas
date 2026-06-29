"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

export type FormResult = { error?: string; ok?: string };

const ROLES: UserRole[] = ["admin", "vendedor", "almacen", "repartidor"];

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
