-- =====================================================================
-- SkyHigh Rutas — El admin puede corregir el nombre y el rol de un usuario
-- 2026-08-03.
--
-- profiles solo tenía policy de SELECT: las escrituras se hacían con la
-- clave service_role desde el servidor (ver el comentario en schema.sql).
-- Eso funciona, pero deja la pantalla de Usuarios dependiendo de que
-- SUPABASE_SERVICE_ROLE_KEY esté bien configurada en el entorno — si falta,
-- falla en silencio y sin pista de por qué.
--
-- Cambiar el nombre o el rol de alguien es una operación de administración
-- normal, no un privilegio de superusuario: se expresa como regla en la
-- base y así funciona con la sesión del propio admin, igual que el resto de
-- la app. Crear y eliminar usuarios sí siguen necesitando service_role,
-- porque tocan auth.users (eso no cambia).
--
-- El guard de "no te cambies el rol a ti mismo" vive en el Server Action:
-- es una regla de sentido común para no quedarse sin admins, no una de
-- seguridad (un admin que quiere degradarse puede hacerlo por SQL igual).
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (app_role() = 'admin')
  with check (app_role() = 'admin');
