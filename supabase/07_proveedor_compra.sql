-- =====================================================================
-- SkyHigh Rutas — Referencia de proveedor y pedido de compra
-- Observaciones de Zenaida (ventas), 2026-07-14 (segunda ronda).
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor (editor vacío).
--
-- Convención de la empresa: "S..." = cotización/venta (numero_pedido
-- cuando tipo=entrega), "P..." = pedido de compra a proveedor.
-- En RECOJO se reutilizan cliente/numero_pedido (ya relabeled en la UI
-- como Proveedor/N° de pedido). Estas 2 columnas nuevas son solo para
-- el caso de una ENTREGA que además requirió una compra asociada.
-- =====================================================================

alter table public.orders
  add column if not exists proveedor text;

alter table public.orders
  add column if not exists numero_pedido_compra text;
