-- =====================================================================
-- SkyHigh Rutas — El creador de una orden tambien puede actualizarla.
-- Necesario para el boton "eliminar adjunto" (quitar un PDF/imagen mal
-- subido): antes solo admin/almacen/repartidor-asignado podian hacer
-- UPDATE sobre orders, asi que vendedor no podia corregir su propia
-- orden recien creada. Se agrega esa condicion sin tocar las demas.
-- =====================================================================

drop policy if exists orders_update on public.orders;

create policy orders_update on public.orders
  for update
  using (
    (app_role() = ANY (ARRAY['admin', 'almacen']))
    OR (app_role() = 'repartidor' AND assigned_to = auth.uid())
    OR created_by = auth.uid()
  );
