-- =====================================================================
-- SkyHigh Rutas — Actualización en vivo del tablero de órdenes
-- Observación de Bryan, 2026-07-15: almacén no veía órdenes nuevas del
-- vendedor sin recargar. Causa: Next.js solo refresca la sesión donde
-- ocurrió la acción; otras sesiones abiertas no se enteran solas.
-- Solución: Supabase Realtime avisa a todos los navegadores conectados
-- cuando cambia una orden, y la app se refresca sola (ver
-- src/components/realtime-refresher.tsx).
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor (editor vacío).
-- (Ya aplicado en producción el 2026-07-15.)
-- =====================================================================

alter publication supabase_realtime add table public.orders;
