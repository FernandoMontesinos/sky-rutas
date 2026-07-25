-- Campo opcional "proyecto" para ordenes de tipo Cliente (entrega).
-- Pedido de Bryan, 2026-07-25: registrar a que proyecto/obra pertenece
-- la entrega cuando se atiende a un cliente (ej. "AREQUIPA", "ANTAMINA").
alter table public.orders add column if not exists proyecto text;
