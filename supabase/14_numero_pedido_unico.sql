-- =====================================================================
-- SkyHigh Rutas — Bloquear pedidos/cotizaciones duplicados.
-- Indice unico case-insensitive: "S14671" y "s14671" cuentan como el
-- mismo numero. Es la ultima linea de defensa (el server action ya
-- valida antes de insertar), por si dos personas crean al mismo tiempo.
-- Los remanentes de backorder no chocan porque llevan sufijo (-R1, -R2).
-- =====================================================================

create unique index if not exists orders_numero_pedido_lower_idx
  on public.orders (lower(numero_pedido));
