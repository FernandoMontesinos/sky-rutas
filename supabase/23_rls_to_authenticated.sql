-- =====================================================================
-- SkyHigh Rutas — Cerrar policies que quedaron abiertas a PUBLIC/anon
-- 2026-08-02.
--
-- 09_notificaciones.sql y 11_rls_backorder.sql crearon sus policies sin
-- "to authenticated". Postgres las aplica entonces a PUBLIC (incluye el rol
-- `anon`, el que usa cualquier visitante sin sesión con la anon key pública
-- del proyecto). Dos de ellas no tienen NINGUNA condición que dependa de la
-- sesión (`with check (true)` / `using (true)`), así que hoy están
-- realmente abiertas:
--   - notifications_insert: cualquiera podría insertar notificaciones para
--     cualquier user_id.
--   - push_subscriptions_select: cualquiera podría leer endpoint/p256dh/
--     auth_key de push de TODOS los usuarios (credenciales de suscripción).
-- Basta con agregar "to authenticated": al no listar `anon`, Postgres
-- deniega por defecto sin evaluar la condición. No hace falta tocar el
-- with check(true)/using(true).
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid());

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated with check (true);

drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated using (true);

drop policy if exists push_subscriptions_write on public.push_subscriptions;
create policy push_subscriptions_write on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Mismo defecto en el backorder: en la práctica ya estaba protegida porque
-- app_role() tiene el EXECUTE revocado para anon (05_security.sql), pero se
-- cierra igual por consistencia y defensa en profundidad.
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert to authenticated
  with check (
    (app_role() = ANY (ARRAY['vendedor', 'admin']) AND created_by = auth.uid())
    OR
    (parent_order_id IS NOT NULL AND app_role() = ANY (ARRAY['repartidor', 'almacen', 'admin']))
  );
