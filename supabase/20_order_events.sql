-- =====================================================================
-- SkyHigh Rutas — Historial de cambios de una orden
-- Pedido de Bryan, 2026-08-01: "puede que ventas 1 cree el pendiente
-- pero ventas2 o administración haga el cambio y para ello tiene que
-- haber un registro".
--
-- Guarda tanto las ediciones de campo (qué cambió, de qué a qué) como
-- los pasos del flujo (quién asignó, quién recogió, quién cerró), para
-- que el panel cuente la vida completa de la orden en un solo hilo.
--
-- Decisiones de seguridad — NO se copia tal cual el patrón de
-- 09_notificaciones.sql, que tiene dos problemas que aquí serían graves:
--
--  * `to authenticated` explícito. Las policies de 09_ se crearon sin
--    cláusula TO, así que Postgres las aplica a PUBLIC, que incluye el
--    rol `anon`. En una tabla de auditoría eso es inaceptable.
--
--  * `user_id` con default `auth.uid()` y check `user_id = auth.uid()`.
--    El patrón de notifications usa `with check (true)` porque notify()
--    escribe a nombre de terceros; acá cada evento se registra a nombre
--    de quien lo hizo, así que se puede exigir. Un historial que se
--    puede falsificar no sirve como historial.
--
--  * `user_id` apunta a public.profiles y no a auth.users, para que
--    PostgREST pueda resolver el embed del nombre del autor.
--
--  * Sin policies de UPDATE ni DELETE: con RLS activo, lo que no tiene
--    policy está prohibido. El historial no se edita ni se borra.
--
-- ON DELETE CASCADE es deliberado: si un admin borra la orden, se va su
-- historial con ella. La alternativa (dejarlo huérfano) obliga a guardar
-- el número de orden duplicado y a mostrar eventos de algo que ya no
-- existe. Consecuencia asumida: borrar la orden borra su evidencia, y
-- borrar órdenes ya era exclusivo de admin.
-- Ejecutar UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

create table if not exists public.order_events (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  user_id       uuid not null default auth.uid() references public.profiles(id),
  tipo          text not null,
  campo         text,
  valor_antes   text,
  valor_despues text,
  nota          text,
  created_at    timestamptz not null default now()
);

-- El panel consulta "where order_id = ? order by created_at desc". Una FK no
-- crea índice sola en Postgres, y esta tabla crece con cada acción de cada
-- orden y nunca se purga.
create index if not exists order_events_order_created_idx
  on public.order_events (order_id, created_at desc);

alter table public.order_events enable row level security;

drop policy if exists order_events_select on public.order_events;
create policy order_events_select on public.order_events
  for select to authenticated using (true);

drop policy if exists order_events_insert on public.order_events;
create policy order_events_insert on public.order_events
  for insert to authenticated with check (user_id = auth.uid());
