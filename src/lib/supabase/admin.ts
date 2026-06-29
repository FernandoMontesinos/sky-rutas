import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave service_role. IGNORA RLS, así que SOLO debe usarse
 * en el servidor (Server Actions) y nunca exponerse al navegador.
 * Se usa para crear/administrar usuarios.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
