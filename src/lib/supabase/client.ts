import { createBrowserClient } from "@supabase/ssr";

// Sin esto, la cookie de sesión queda como "de sesión del navegador" y se
// pierde al cerrar la app; con esto dura mientras el refresh token siga
// siendo válido (hasta logout explícito o cambio de contraseña).
const SESSION_MAX_AGE = 60 * 60 * 24 * 365 * 100;

/** Cliente de Supabase para componentes del navegador ("use client"). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { maxAge: SESSION_MAX_AGE } }
  );
}
