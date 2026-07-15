-- =====================================================================
-- SkyHigh Rutas — Backorder automático para entregas/recojos parciales
-- Pedido de Bryan, 2026-07-15 (tercera ronda). Patrón "backorder", el
-- mismo concepto que ya usa Odoo para entregas parciales.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor (editor vacío).
-- =====================================================================

alter table public.orders
  add column if not exists parent_order_id uuid references public.orders(id) on delete set null;

create index if not exists orders_parent_order_id_idx on public.orders(parent_order_id);
