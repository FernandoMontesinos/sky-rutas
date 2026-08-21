-- =====================================================================
-- SkyHigh Rutas — Eliminar orden vuelve a ser solo Admin
-- 2026-08-21.
--
-- Revierte 29_orders_delete_ventas.sql: Ventas puede corregir datos
-- (orders_update, sin cambios) pero ya no puede borrar la orden, ni
-- siquiera mientras esté 'pendiente'. Bryan pidió esto de vuelta tras
-- revisar que el botón de eliminar quedaba visible para Ventas en
-- cotizaciones y pedidos.
--
-- Va en la policy y no solo en el Server Action a propósito: el guard de
-- la aplicación se esquiva llamando a la API directo con la anon key.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

drop policy if exists orders_delete on public.orders;

create policy orders_delete on public.orders
  for delete to authenticated
  using (app_role() = 'admin');
