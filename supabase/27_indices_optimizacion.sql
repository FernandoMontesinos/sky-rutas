-- =====================================================================
-- SkyHigh Rutas — Índices que faltaban
-- 2026-08-02.
--
-- created_by: el filtro "Creado por" y la búsqueda por nombre de vendedor
-- en /ordenes filtran por esta columna igual que el filtro de repartidor
-- filtra por assigned_to — pero solo assigned_to tenía índice.
--
-- completed_at: la consulta "completadas" del tablero (la que más se
-- ejecuta: corre en cada carga de /ordenes, para todos los roles) filtra
-- por estado='completado' Y por rango de completed_at, y ordena por esa
-- misma columna. 'completado' es el único estado que se acumula para
-- siempre (los demás son transitorios), así que con el volumen la consulta
-- se vuelve cada vez más cara sin un índice que cubra justo ese filtro.
-- Se usa un índice parcial (solo filas completadas) para que sea chico y
-- resuelva exactamente esa consulta.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

create index if not exists orders_created_by_idx on public.orders (created_by);

create index if not exists orders_completado_completed_at_idx
  on public.orders (completed_at desc)
  where estado = 'completado';
