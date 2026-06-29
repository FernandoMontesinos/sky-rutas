-- =====================================================================
-- SkyHigh Rutas — Modalidad de entrega
-- Distingue cómo se entrega cada orden:
--   reparto  = lo lleva un repartidor (flujo normal)
--   oficina  = el cliente lo recoge en oficina
--   courier  = se envía por courier a Lima
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor (editor vacío).
-- =====================================================================

do $$ begin
  create type public.delivery_method as enum ('reparto', 'oficina', 'courier');
exception when duplicate_object then null; end $$;

alter table public.orders
  add column if not exists modalidad public.delivery_method not null default 'reparto';

alter table public.orders
  add column if not exists courier_tracking text;
