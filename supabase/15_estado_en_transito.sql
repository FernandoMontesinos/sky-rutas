-- =====================================================================
-- SkyHigh Rutas — Estado "En Tránsito" para los Pedidos (Proveedor)
-- Pedido de Bryan, 2026-07-31.
--
-- Problema: el repartidor que recoge material de un proveedor NO cuenta
-- los ítems (recibe bultos sellados), así que no puede afirmar que el
-- pedido llegó completo. Antes su confirmación cerraba la orden como
-- "Completado" y, si marcaba parcial, generaba el remanente — todo con
-- la palabra de quien no contó la mercadería.
--
-- Ahora el flujo de un Pedido queda:
--   Pendiente -> Asignado -> En Tránsito -> Completado
-- El repartidor solo sube la guía y confirma el recojo (En Tránsito).
-- Quien CUENTA la mercadería es quien elige completa/parcial y cierra:
--   * almacén/admin, cuando el material llega al depósito, o
--   * el repartidor asignado, cuando el material va directo del
--     proveedor al cliente y el cliente cuenta y firma delante suyo.
--
-- Las Cotizaciones (Cliente) NO cambian: ahí el cliente cuenta en el
-- momento de la entrega, así que no existe ese tramo sin contar.
--
-- IMPORTANTE: los tres bloques van SEPARADOS a propósito. Postgres no
-- permite usar un valor de enum recién agregado dentro de la misma
-- transacción en la que se creó, así que si algún día se agrega aquí un
-- UPDATE que use 'en_transito', debe ir en su propio paso.
-- Ejecutar UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

-- 1) Nuevo estado, ubicado entre "asignado" y "completado" para que el
--    orden del enum siga el orden real del flujo.
alter type public.order_status add value if not exists 'en_transito' after 'asignado';

-- 2) Momento del recojo, para poder medir en los reportes cuánto se
--    demora entre que se recoge y que se verifica.
alter table public.orders add column if not exists en_transito_at timestamptz;

-- 3) Nuevo tipo de notificación: aviso a almacén de que hay material
--    recogido esperando verificación.
alter type public.notif_tipo add value if not exists 'orden_en_transito' after 'orden_asignada';
