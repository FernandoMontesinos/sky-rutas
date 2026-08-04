-- =====================================================================
-- SkyHigh Rutas — La campanita en vivo (registro de un cambio ya hecho)
-- 2026-08-02.
--
-- 08_realtime_orders.sql agregó "orders" a la publicación de Supabase
-- Realtime, pero ningún archivo de este repo hizo lo mismo con
-- "notifications". Al revisarlo en vivo (pg_publication_tables) resultó
-- que la tabla YA está en la publicación — alguien la agregó a mano desde
-- el dashboard (Database -> Replication) en algún momento, fuera de un
-- migration file. Se dejaba este archivo igual, de forma idempotente, para
-- que el repo quede como fuente de verdad y un entorno nuevo (o un branch
-- de Supabase) quede igual sin depender de un clic manual.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
