-- =====================================================================
-- SkyHigh Rutas — Almacén también puede crear órdenes
-- Pedido de Fernando: Almacén (Robert) necesita registrar órdenes para
-- casos especiales que no vienen de una venta — p. ej. mandar camisas a
-- bordar a un proveedor. Antes solo Ventas/Admin podían crear.
--
-- Se agrega 'almacen' a la primera condición de orders_insert (creación
-- normal: el rol permitido y como su propio autor). La segunda condición
-- (el backorder automático, parent_order_id no nulo) se deja igual.
--
-- La capa de RLS es la que de verdad habilita esto: sin ella, aunque la
-- app muestre el formulario, la API rechazaría el insert de un almacén.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

drop policy if exists orders_insert on public.orders;

create policy orders_insert on public.orders
  for insert to authenticated
  with check (
    (app_role() = ANY (ARRAY['vendedor', 'almacen', 'admin']) AND created_by = auth.uid())
    OR
    (parent_order_id IS NOT NULL AND app_role() = ANY (ARRAY['repartidor', 'almacen', 'admin']))
  );
