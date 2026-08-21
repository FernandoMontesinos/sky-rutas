-- =====================================================================
-- SkyHigh Rutas — Acotar el borrado en storage (era demasiado abierto)
-- Pendiente §5.2 del HANDOFF-PILOTO (2026-08-09).
--
-- La policy "borrado autenticado" (25_storage_delete_policy.sql) dejaba
-- que CUALQUIER usuario con sesión borrara CUALQUIER archivo de ambos
-- buckets vía API. La app no lo expone, pero la policy sí: eliminarAdjunto()
-- corre con la sesión del usuario (createClient de server.ts), no con
-- service_role, así que esta regla es la que realmente controla el borrado.
--
-- Se restringe a:
--   * admin / almacen: pueden borrar en ambos buckets (gestionan la orden).
--   * vendedor: conserva la "x" SOLO sobre sus propias imagenes de orden
--     (bucket 'ordenes', donde la carpeta es el uid de quien subio). Sin
--     esto, Ventas no podria quitar el PDF/foto de una orden pendiente.
--   * repartidor / facturacion: no borran (no lo necesitan).
--
-- IMPORTANTE: revisar y probar antes de mergear — toca el borrado real de
-- adjuntos. Verificar 3 caminos contra la base/app:
--   1) Ventas quita su propio adjunto de una orden pendiente -> funciona.
--   2) Almacen borra un adjunto -> funciona.
--   3) Un repartidor intenta borrar por API -> denegado (0 filas).
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

drop policy if exists "borrado autenticado" on storage.objects;

create policy "borrado autenticado" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('ordenes', 'guias')
    and (
      public.app_role() in ('admin', 'almacen')
      or (
        public.app_role() = 'vendedor'
        and bucket_id = 'ordenes'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  );
