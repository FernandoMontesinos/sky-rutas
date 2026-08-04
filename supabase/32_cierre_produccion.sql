-- =====================================================================
-- SkyHigh Rutas — Cierre antes de pasar a producción
-- 2026-08-04.
--
-- Dos cosas que salieron del linter de Supabase al revisar la rama:
--
-- 1) orders_proteger_columnas() es SECURITY DEFINER y quedaba expuesta como
--    RPC (/rest/v1/rpc/...) para anon y authenticated. Llamarla por ahí no
--    hace nada malo hoy (Postgres rechaza invocar una función de trigger
--    fuera de un trigger), pero no hay razón para que esté publicada. El
--    trigger sigue funcionando igual: el disparo NO comprueba el permiso
--    EXECUTE del usuario, eso se valida al crear el trigger.
--
--    OJO con el REVOKE: al crear una función, Postgres le da EXECUTE a
--    PUBLIC por defecto, y anon/authenticated lo heredan de ahí. Revocarles
--    a ellos por nombre no quita nada (se comprobó: el permiso seguía como
--    "=X/postgres", que es justamente la entrada de PUBLIC). Hay que
--    revocárselo a PUBLIC.
--
-- 2) Tres claves foráneas sin índice. La que de verdad pesa es
--    notifications.order_id: al borrar una orden Postgres tiene que buscar
--    las notificaciones que la referencian, y sin índice eso es un scan de
--    toda la tabla (que es la que más filas acumula de las tres).
--
-- Los avisos de "auth_rls_initplan" del mismo linter (envolver auth.uid()
-- en (select auth.uid()) para que se evalúe una vez y no por fila) quedan
-- pendientes a propósito: tocan ~10 policies que controlan TODO el acceso,
-- y el beneficio es de latencia a un volumen que todavía no existe. Vale la
-- pena hacerlo, pero como un cambio propio y con su verificación, no metido
-- en el cierre de otra cosa.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

revoke execute on function public.orders_proteger_columnas() from public;
revoke execute on function public.orders_proteger_columnas() from anon, authenticated;

create index if not exists notifications_order_id_idx
  on public.notifications (order_id);

create index if not exists order_events_user_id_idx
  on public.order_events (user_id);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);
