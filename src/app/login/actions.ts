"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid login credentials")) {
      return { error: "Correo o contraseña incorrectos." };
    }
    if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
      return {
        error:
          "Tu usuario aún no está confirmado en Supabase. Confírmalo (o desactiva 'Confirm email').",
      };
    }
    if (msg.includes("api key") || msg.includes("fetch") || msg.includes("failed")) {
      return {
        error:
          "Problema de conexión con Supabase. Revisa las variables NEXT_PUBLIC_SUPABASE_URL y ANON_KEY en Vercel.",
      };
    }
    // Cualquier otro caso: mostramos el motivo real para poder diagnosticar.
    return { error: "No se pudo iniciar sesión: " + error.message };
  }

  redirect("/");
}
