-- =====================================================================
-- SkyHigh Rutas — Cerrar el listado anónimo de las fotos de storage
-- 2026-08-09. Antes de la prueba piloto.
--
-- 23_rls_to_authenticated.sql cerró las policies abiertas a PUBLIC en las
-- tablas de `public`, pero se saltó `storage.objects`. La policy
-- "lectura publica ordenes" quedó sin "to authenticated", así que Postgres
-- la aplica a PUBLIC — incluido el rol `anon`, el que usa cualquiera con la
-- anon key, que es pública por diseño (va dentro del JavaScript que sirve la
-- app, cualquiera la lee desde el navegador).
--
-- Comprobado contra el proyecto real, sin iniciar sesión:
--   POST /storage/v1/object/list/guias  -> devolvía la lista de carpetas
--   POST .../list/guias {prefix:"<carpeta>/"} -> los nombres de archivo
--   GET  /storage/v1/object/public/guias/<carpeta>/<archivo> -> HTTP 200
-- O sea: se podían enumerar y descargar TODAS las guías de remisión y fotos
-- de órdenes (razón social, RUC, direcciones, cantidades) sin credenciales.
--
-- Agregar "to authenticated" corta la enumeración: sin `anon` en la lista,
-- Postgres deniega sin evaluar la condición.
--
-- Las fotos que ya están guardadas NO se rompen. Los buckets siguen siendo
-- públicos y las URLs guardadas en orders (imagenes_urls, guias_urls,
-- material_urls) apuntan a /object/public/..., que en un bucket público se
-- sirve sin pasar por RLS. Verificado en un bucket desechable: con el SELECT
-- restringido a authenticated, el listado anónimo devolvía [] y la descarga
-- por URL pública seguía dando HTTP 200 con el contenido.
--
-- Queda pendiente (post-piloto): quien tenga una URL completa igual puede
-- abrirla sin sesión. Cerrar eso requiere buckets privados + URLs firmadas,
-- lo que obliga a migrar las URLs ya guardadas en la base y a generarlas al
-- vuelo en cada pantalla — cambio grande, no para la víspera del piloto.
--
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

drop policy if exists "lectura publica ordenes" on storage.objects;
create policy "lectura publica ordenes" on storage.objects
  for select to authenticated
  using (bucket_id in ('ordenes', 'guias'));
