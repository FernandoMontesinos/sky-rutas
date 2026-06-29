-- =====================================================================
-- SkyHigh Rutas — Campo Cliente / Proveedor
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor (editor vacío).
-- =====================================================================

alter table public.orders
  add column if not exists cliente text;
