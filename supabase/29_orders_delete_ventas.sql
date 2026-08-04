-- =====================================================================
-- SkyHigh Rutas — Ventas también puede eliminar, pero solo lo que aún
-- nadie tocó
-- 2026-08-03.
--
-- Pedido de Bryan: el botón de eliminar debe estar disponible para Ventas
-- y Admin, y para nadie más (almacén y repartidor trabajan sobre la orden
-- pero no son dueños del registro).
--
-- La policy anterior era solo admin. Se suma vendedor con el mismo límite
-- que ya tiene para corregir: únicamente mientras la orden siga
-- 'pendiente'. Después de eso ya hay trabajo encima (asignación, guías,
-- historial) y borrarla se lo lleva puesto — a partir de ahí solo Admin.
--
-- Va en la policy y no solo en el Server Action a propósito: el guard de
-- la aplicación se esquiva llamando a la API directo con la anon key.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

drop policy if exists orders_delete on public.orders;

create policy orders_delete on public.orders
  for delete to authenticated
  using (
    app_role() = 'admin'
    OR (app_role() = 'vendedor' AND estado = 'pendiente')
  );
