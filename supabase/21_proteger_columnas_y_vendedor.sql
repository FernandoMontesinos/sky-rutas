-- =====================================================================
-- SkyHigh Rutas — Ventas puede corregir órdenes ajenas, con límites reales
-- 2026-08-01.
--
-- Bryan pidió que cualquier vendedor pueda corregir una orden, no solo
-- quien la creó (Ventas2 arregla lo que cargó Ventas1). El problema es
-- que las policies de Postgres son por FILA, no por columna: dar UPDATE
-- sobre la orden da UPDATE sobre TODAS sus columnas — estado, guías,
-- assigned_to, created_by, completed_at.
--
-- Un `GRANT UPDATE (columna)` no sirve acá: los cuatro roles de la app
-- (admin, vendedor, almacén, repartidor) viven en public.profiles.role y
-- a nivel de Postgres los cuatro son el MISMO rol, `authenticated`. Un
-- grant por columna no puede distinguirlos.
--
-- La única forma que aplica a este modelo es un trigger. Con las columnas
-- sensibles protegidas ahí, recién entonces se puede ampliar la policy.
-- El guard "solo si está pendiente" del Server Action NO alcanza por sí
-- solo: es código de aplicación y se puede esquivar llamando a la API
-- directamente con la anon key.
--
-- Nota sobre el trigger y service_role: se usa coalesce(app_role(),'')
-- para que un contexto sin perfil también quede bloqueado. Para una
-- corrección de mantenimiento por SQL hay que desactivar el trigger a
-- propósito (alter table ... disable trigger), que es justamente la
-- fricción que se busca.
-- Ejecutar UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

create or replace function public.orders_proteger_columnas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Solo admin puede tocar estas tres:
  --   numero_pedido -> es la identidad de la orden y tiene índice único
  --   created_by    -> decide quién tiene permiso sobre ella para siempre
  --   tipo          -> cambia el significado entero del registro
  if coalesce(public.app_role(), '') <> 'admin' then
    if new.numero_pedido is distinct from old.numero_pedido then
      raise exception 'El numero de orden no se puede cambiar';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'No se puede cambiar quien creo la orden';
    end if;
    if new.tipo is distinct from old.tipo then
      raise exception 'No se puede cambiar el tipo de la orden';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_proteger_columnas on public.orders;
create trigger orders_proteger_columnas
  before update on public.orders
  for each row execute function public.orders_proteger_columnas();

drop policy if exists orders_update on public.orders;

create policy orders_update on public.orders
  for update to authenticated
  using (
    (app_role() = ANY (ARRAY['admin', 'almacen', 'vendedor']))
    OR (app_role() = 'repartidor' AND assigned_to = auth.uid())
    OR created_by = auth.uid()
  )
  with check (
    (app_role() = ANY (ARRAY['admin', 'almacen', 'vendedor']))
    OR (app_role() = 'repartidor' AND (assigned_to = auth.uid() OR assigned_to IS NULL))
    OR created_by = auth.uid()
  );
