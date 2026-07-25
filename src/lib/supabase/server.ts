import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Ver nota en lib/supabase/client.ts: evita que la cookie de sesión se
// trate como "de sesión del navegador" y se pierda al cerrar la app.
const SESSION_MAX_AGE = 60 * 60 * 24 * 365 * 100;

/**
 * Cliente de Supabase para Server Components y Server Actions.
 * En Next.js 16 `cookies()` es asíncrono, por eso esta función es async.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { maxAge: SESSION_MAX_AGE },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component: lo ignoramos.
            // El proxy.ts se encarga de refrescar la sesión.
          }
        },
      },
    }
  );
}
