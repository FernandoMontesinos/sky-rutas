-- =====================================================================
-- SkyHigh Rutas — Número de guía manual + fotos de material separadas
-- 2026-08-02.
--
-- Pedido de Bryan: separar la foto de la guía de remisión (documento del
-- proveedor, obligatoria) de las fotos del material/bultos (opcionales,
-- para dejar constancia del estado en que llegó). El número de guía
-- (formato SUNAT, ej. "T002-0001") se escribe a mano — el OCR queda para
-- una mejora futura, nunca como fuente de verdad: una foto movida o
-- borrosa daría un número equivocado, que es peor que no tenerlo.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

alter table public.orders add column if not exists numero_guia text;
alter table public.orders add column if not exists material_urls text[] not null default '{}';
