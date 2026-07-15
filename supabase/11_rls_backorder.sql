-- =====================================================================
-- SkyHigh Rutas — Permitir que el backorder se cree desde completeOrder
-- Bug encontrado en pruebas: la política orders_insert solo dejaba
-- crear órdenes a vendedor/admin como su propio autor. El backorder
-- automático de una entrega parcial lo dispara quien complete la orden
-- (puede ser repartidor o almacén), así que la inserción quedaba
-- bloqueada en silencio por RLS. Se agrega una condición específica
-- para ese caso (parent_order_id no nulo), sin tocar la regla general.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor (editor vacío).
-- =====================================================================

drop policy if exists orders_insert on public.orders;

create policy orders_insert on public.orders
  for insert
  with check (
    (app_role() = ANY (ARRAY['vendedor', 'admin']) AND created_by = auth.uid())
    OR
    (parent_order_id IS NOT NULL AND app_role() = ANY (ARRAY['repartidor', 'almacen', 'admin']))
  );
