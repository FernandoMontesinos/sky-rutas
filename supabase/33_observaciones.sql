-- =====================================================================
-- SkyHigh Rutas — Observaciones en cualquier orden, no solo en las parciales
-- 2026-08-05.
--
-- Hasta ahora el único cuadro de texto al cerrar aparecía al marcar
-- "Parcial", y ese texto tiene un uso concreto: es lo que queda pendiente y
-- se convierte en la orden del remanente. No servía para dejar constancia de
-- una eventualidad en una entrega que sí salió completa ("el cliente recibió
-- con la puerta cerrada", "llegó una caja golpeada").
--
-- Se agrega una columna aparte, no se reutiliza `nota`: esa es de Ventas y
-- describe el pedido; esta la escribe quien opera y describe lo que pasó.
-- Mezclarlas haría que corregir una pisara la otra.
--
-- Guarda la última observación escrita (es la que se muestra en la ficha).
-- El hilo completo, con autor y fecha de cada una, vive en order_events.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

alter table public.orders add column if not exists observaciones text;
