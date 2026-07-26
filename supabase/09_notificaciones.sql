-- =====================================================================
-- SkyHigh Rutas — Notificaciones (campanita en la app + push real)
-- Pedido de Bryan, 2026-07-15.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor (editor vacío).
-- =====================================================================

create type public.notif_tipo as enum (
  'orden_pendiente',   -- aviso a almacén: el vendedor subió una orden nueva
  'orden_asignada',    -- aviso al repartidor: le asignaron una orden
  'orden_completada',  -- aviso al vendedor: su orden se completó (total)
  'orden_parcial'      -- aviso al vendedor: su orden quedó parcial
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  tipo public.notif_tipo not null,
  titulo text not null,
  mensaje text not null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_created_idx
  on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

-- Cada quien ve y marca como leídas solo sus propias notificaciones.
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());

create policy notifications_update on public.notifications
  for update using (user_id = auth.uid());

-- Cualquier usuario autenticado puede crear una notificación para otro
-- (lo hacen las Server Actions al crear/asignar/completar una orden, en
-- nombre de terceros: vendedor crea -> notifica a almacén, etc.). No usa
-- service_role a propósito, para no exponer esa clave en el cliente.
create policy notifications_insert on public.notifications
  for insert with check (true);

-- Suscripciones de notificaciones push del navegador (Web Push).
-- Un mismo usuario puede tener varias (celular + PC).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Lectura abierta a autenticados: el servidor necesita ver las
-- suscripciones de OTROS usuarios para enviarles el push (ej. el
-- vendedor crea una orden, el servidor busca las suscripciones de
-- almacén). Igual que notifications_insert, sin service_role a
-- propósito, porque es una app interna de confianza.
create policy push_subscriptions_select on public.push_subscriptions
  for select using (true);

-- Cada quien solo administra (crea/borra) su propia suscripción.
create policy push_subscriptions_write on public.push_subscriptions
  for insert with check (user_id = auth.uid());

create policy push_subscriptions_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());
