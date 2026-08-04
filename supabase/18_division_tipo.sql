-- =====================================================================
-- SkyHigh Rutas — Envío dividido vs. remanente por error
-- Pedido de Bryan, 2026-08-01.
--
-- Una orden hija podía nacer por dos motivos completamente distintos y
-- hasta ahora se veían iguales en el reporte:
--
--   'remanente' (-R) -> el repartidor llegó al punto y faltaban ítems.
--                       Es una FALLA: alguien despachó incompleto.
--   'envio'     (-E) -> almacén sabía de antemano que esa cotización se
--                       despacha en varias guías de remisión (no hay
--                       stock de todo, o no entra en un solo viaje).
--                       Es una DECISIÓN planificada, no un error.
--
-- Mezclarlas hacía imposible medir cuántas veces se falla de verdad.
--
-- Las hijas que ya existen nacieron todas del flujo de entrega parcial,
-- así que se marcan como 'remanente'.
--
-- El índice sobre parent_order_id es para la numeración: al crear una
-- hija hay que recorrer el árbol hasta la raíz y contar los descendientes
-- del mismo tipo, y eso consulta por parent_order_id varias veces.
-- Ejecutar UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

alter table public.orders add column if not exists division_tipo text;

alter table public.orders drop constraint if exists orders_division_tipo_check;
alter table public.orders add constraint orders_division_tipo_check
  check (division_tipo is null or division_tipo in ('remanente', 'envio'));

update public.orders set division_tipo = 'remanente'
  where parent_order_id is not null and division_tipo is null;

create index if not exists orders_parent_order_id_idx on public.orders (parent_order_id);
