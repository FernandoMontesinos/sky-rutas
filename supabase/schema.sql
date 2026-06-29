-- =====================================================================
-- SkyHigh Rutas — Esquema de base de datos (Supabase / PostgreSQL)
-- Ejecuta TODO este archivo una sola vez en:
--   Supabase Dashboard -> SQL Editor -> New query -> pega y RUN
-- =====================================================================

-- ---------- Tipos ----------
do $$ begin
  create type public.user_role as enum ('admin', 'vendedor', 'almacen', 'repartidor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_type as enum ('entrega', 'recojo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('pendiente', 'asignado', 'completado');
exception when duplicate_object then null; end $$;

-- ---------- Tabla de perfiles (1 fila por usuario de auth) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        public.user_role not null default 'vendedor',
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- Tabla de órdenes ----------
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  numero_pedido  text not null,
  tipo           public.order_type not null,
  estado         public.order_status not null default 'pendiente',
  imagen_url     text,                       -- imagen de la orden (pegada por vendedor)
  guia_url       text,                       -- foto de la guía (tomada por repartidor)
  nota           text,
  created_by     uuid references public.profiles(id),
  assigned_to    uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  assigned_at    timestamptz,
  completed_at   timestamptz
);

create index if not exists orders_estado_idx on public.orders (estado);
create index if not exists orders_assigned_to_idx on public.orders (assigned_to);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- ---------- Helper: rol del usuario actual ----------
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid()
$$;

-- ---------- Crear perfil automáticamente al crear usuario en Auth ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'vendedor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.orders   enable row level security;

-- PROFILES: cualquier usuario autenticado puede leer la lista (nombres/roles).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

-- (Las inserciones/actualizaciones de perfiles las hace el servidor con la
--  service_role key, que ignora RLS. Por eso no hace falta policy de escritura.)

-- ORDERS: todos los usuarios internos pueden ver las órdenes.
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated using (true);

-- Crear orden: solo vendedor o admin, y debe ser el autor.
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert to authenticated
  with check (
    public.app_role() in ('vendedor', 'admin')
    and created_by = auth.uid()
  );

-- Actualizar orden:
--   admin/almacen pueden todo (asignar, etc.)
--   repartidor solo sus propias órdenes asignadas (subir guía / completar)
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update to authenticated
  using (
    public.app_role() in ('admin', 'almacen')
    or (public.app_role() = 'repartidor' and assigned_to = auth.uid())
  )
  with check (
    public.app_role() in ('admin', 'almacen')
    or (public.app_role() = 'repartidor' and assigned_to = auth.uid())
  );

-- Borrar orden: solo admin.
drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
  for delete to authenticated
  using (public.app_role() = 'admin');

-- =====================================================================
-- Storage: buckets para imágenes
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('ordenes', 'ordenes', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('guias', 'guias', true)
on conflict (id) do nothing;

-- Lectura pública (las imágenes se muestran por URL pública).
drop policy if exists "lectura publica ordenes" on storage.objects;
create policy "lectura publica ordenes" on storage.objects
  for select using (bucket_id in ('ordenes', 'guias'));

-- Subida: cualquier usuario autenticado.
drop policy if exists "subida autenticada" on storage.objects;
create policy "subida autenticada" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('ordenes', 'guias'));

-- =====================================================================
-- LISTO. Después de ejecutar esto:
-- 1) Crea tu primer usuario en  Authentication -> Users -> Add user
--    (marca "Auto Confirm User").
-- 2) Conviértelo en admin ejecutando (reemplaza el email):
--      update public.profiles set role = 'admin'
--      where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
-- 3) Inicia sesión en la app y crea el resto de usuarios desde /admin/usuarios
-- =====================================================================
