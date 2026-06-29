-- =====================================================================
-- SkyHigh Rutas — Geolocalización de repartidores
-- Ejecuta este archivo UNA VEZ en Supabase -> SQL Editor (después del
-- schema.sql principal).
-- =====================================================================

create table if not exists public.repartidor_locations (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  accuracy    double precision,
  updated_at  timestamptz not null default now()
);

alter table public.repartidor_locations enable row level security;

-- Cualquier usuario interno puede VER las ubicaciones (el mapa lo usan
-- almacén y admin).
drop policy if exists rl_select on public.repartidor_locations;
create policy rl_select on public.repartidor_locations
  for select to authenticated using (true);

-- Cada quien solo puede registrar/actualizar SU propia ubicación.
drop policy if exists rl_insert on public.repartidor_locations;
create policy rl_insert on public.repartidor_locations
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists rl_update on public.repartidor_locations;
create policy rl_update on public.repartidor_locations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
