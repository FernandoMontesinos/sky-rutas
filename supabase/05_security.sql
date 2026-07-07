-- =====================================================================
-- SkyHigh Rutas — Endurecimiento de seguridad
-- Origen: avisos del linter de seguridad de Supabase (get_advisors).
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor (editor vacío).
-- (Aplicado en producción el 2026-07-07.)
-- =====================================================================

-- 1) handle_new_user() es una función de trigger SECURITY DEFINER.
--    Nadie necesita llamarla directamente por la API (/rest/v1/rpc/...):
--    el trigger la ejecuta solo, sin requerir permiso EXECUTE del caller.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

-- 2) app_role() SÍ debe seguir ejecutable por 'authenticated' porque las
--    políticas RLS de orders la evalúan con los privilegios del usuario.
--    Solo se la quitamos al rol anónimo (sin sesión no tiene sentido).
revoke execute on function public.app_role() from public;
revoke execute on function public.app_role() from anon;
grant execute on function public.app_role() to authenticated;

-- 3) Pendiente manual (no es SQL): en el Dashboard de Supabase ->
--    Authentication -> Passwords, activar "Leaked password protection"
--    para rechazar contraseñas filtradas conocidas (HaveIBeenPwned).
