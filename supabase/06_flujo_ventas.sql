-- =====================================================================
-- SkyHigh Rutas — Flujo de ventas: entrega parcial + multiples archivos
-- Observaciones de Zenaida (ventas), 2026-07-14.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor (editor vacío).
-- =====================================================================

-- Entrega/recojo parcial: se marca al completar la orden (ver 08_...).
alter table public.orders
  add column if not exists entrega_parcial boolean not null default false;

-- Múltiples imágenes de la orden y múltiples fotos de guía.
-- Se agregan columnas nuevas en vez de reemplazar imagen_url/guia_url
-- para no perder los datos ya cargados en producción.
alter table public.orders
  add column if not exists imagenes_urls text[] not null default '{}';

alter table public.orders
  add column if not exists guias_urls text[] not null default '{}';

-- Migra lo ya existente a los nuevos arreglos (no destructivo, idempotente).
update public.orders
  set imagenes_urls = array[imagen_url]
  where imagen_url is not null and imagenes_urls = '{}';

update public.orders
  set guias_urls = array[guia_url]
  where guia_url is not null and guias_urls = '{}';
