-- =====================================================================
-- SkyHigh Rutas — "No se recogió" en los Pedidos (Proveedor)
-- Pedido de almacén, 2026-08-01.
--
-- El repartidor llega donde el proveedor y el material no está listo (no
-- lo tienen, falta producción, no encuentran la orden, etc.). Antes no
-- había forma de registrarlo: la orden se quedaba "Asignada" para
-- siempre o alguien la cerraba en falso.
--
-- A propósito NO es un estado nuevo del enum: los otros cuatro son
-- etapas de un camino que avanza, y esto es un intento que falló — la
-- orden no avanzó, retrocedió. Por eso vuelve a "pendiente" (queda libre
-- para reasignar) y estas columnas guardan el rastro:
--
--   * intentos: cuántas veces se fue y no se pudo. Ver "×3" en una orden
--     dice a simple vista qué proveedor está fallando repetido.
--   * motivo: lo último que reportó el repartidor.
--   * at: cuándo fue el último intento fallido.
--
-- En el tablero estas órdenes se agrupan arriba de la columna Pendientes
-- con etiqueta roja, para que almacén las distinga de las órdenes nuevas
-- (una necesita "asignar repartidor", la otra "llamar al proveedor").
-- Ejecutar UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

alter table public.orders
  add column if not exists no_recogido_intentos int not null default 0,
  add column if not exists no_recogido_motivo text,
  add column if not exists no_recogido_at timestamptz;
