-- =====================================================================
-- SkyHigh Rutas — Anular una orden (el cliente canceló la OC)
-- Pedido de Fernando: cuando un cliente se arrepiente y cancela la orden
-- de compra, hoy la única salida es ELIMINARLA, y con eso se pierde el
-- rastro de que existió. Anular es lo contrario de eliminar: la orden se
-- queda, deja de estar en circulación y queda el registro de por qué.
--
-- Se resuelve con un estado nuevo, no con una bandera aparte: todas las
-- consultas del tablero ya filtran por `estado`
-- (.in('pendiente','asignado','en_transito') para las activas,
-- .eq('completado') para las cerradas), así que una orden anulada
-- desaparece sola de las columnas sin tener que acordarse de añadir un
-- "and anulada = false" en cada consulta — que es justo el tipo de olvido
-- que deja fugas.
--
-- El motivo se guarda en su propia columna y además queda en
-- order_events con autor y fecha, igual que el resto del historial.
--
-- OJO con el enum: ALTER TYPE ... ADD VALUE no puede convivir en la misma
-- transacción con sentencias que USEN el valor nuevo. Acá no se usa
-- 'anulado' en ningún UPDATE, solo se agregan columnas, así que el bloque
-- corre entero sin problema. Si más adelante se agrega un UPDATE que lo
-- use, tiene que ir en su propio paso.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

alter type public.order_status add value if not exists 'anulado' after 'completado';

alter table public.orders
  add column if not exists anulada_motivo text,
  add column if not exists anulada_at timestamptz,
  add column if not exists anulada_por uuid references public.profiles(id);
