-- =====================================================================
-- SkyHigh Rutas — Aviso cuando alguien edita una orden
-- 2026-08-01.
--
-- Va SOLO en este archivo, sin nada más, a propósito: Postgres no permite
-- usar un valor de enum recién agregado dentro de la misma transacción en
-- que se creó, y el SQL Editor de Supabase ejecuta el script pegado como
-- un solo bloque. Es la misma restricción anotada en
-- 15_estado_en_transito.sql.
-- Ejecutar UNA VEZ en Supabase -> SQL Editor, DESPUÉS de 21_.
-- =====================================================================

alter type public.notif_tipo add value if not exists 'orden_editada' after 'orden_asignada';
