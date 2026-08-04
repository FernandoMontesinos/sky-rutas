-- =====================================================================
-- SkyHigh Rutas — Falta la policy de DELETE en storage.objects
-- 2026-08-02.
--
-- schema.sql creó policies de SELECT (lectura pública) e INSERT (subida
-- autenticada) para los buckets "ordenes"/"guias", pero nunca una de
-- DELETE. eliminarAdjunto() en actions.ts intenta borrar el archivo real
-- del storage desde hace tiempo (supabase.storage.from("ordenes").remove),
-- pero como no hay policy de DELETE, Postgres lo bloquea en silencio: la
-- llamada no lanza error (RLS solo hace que no encuentre filas que borrar),
-- así que nunca se notó. Los archivos huérfanos se acumulan en el bucket
-- desde que existe esa función.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

drop policy if exists "borrado autenticado" on storage.objects;
create policy "borrado autenticado" on storage.objects
  for delete to authenticated
  using (bucket_id in ('ordenes', 'guias'));
