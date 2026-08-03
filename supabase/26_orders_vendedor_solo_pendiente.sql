-- =====================================================================
-- SkyHigh Rutas — Vendedor: acotar la policy de UPDATE que quedó demasiado
-- abierta al sumar el rol
-- 2026-08-02.
--
-- 21_proteger_columnas_y_vendedor.sql sumó 'vendedor' a orders_update para
-- que cualquier vendedor pueda corregir una orden ajena (Ventas2 arregla lo
-- que cargó Ventas1). El problema: el trigger que acompaña esa migración
-- solo protege 3 columnas (numero_pedido, created_by, tipo) para no-admin.
-- El límite real que existe hoy — "solo mientras esté pendiente" y "solo
-- estos 5 campos" — vive nada más en editarOrden() (Server Action), código
-- de aplicación que se puede esquivar llamando a la API directo con la
-- anon key y la sesión de cualquier vendedor. Con eso, hoy un vendedor
-- podría cerrar, reasignar o reabrir CUALQUIER orden de CUALQUIER estado.
--
-- Se extiende el trigger para que la base imponga lo mismo que ya intenta
-- garantizar editarOrden(): si quien edita es vendedor, la fila tiene que
-- seguir "pendiente" y ningún campo fuera de los 5 editables puede cambiar.
-- Comparar con jsonb en vez de enumerar columna por columna es a propósito:
-- así una columna nueva que se agregue después queda protegida por
-- defecto, sin tener que acordarse de sumarla acá.
-- Ejecuta este bloque UNA VEZ en Supabase -> SQL Editor.
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

  -- Vendedor: mismo límite que ya intenta imponer editarOrden() en la
  -- aplicación, pero exigido acá para que no se pueda esquivar. Solo puede
  -- tocar una orden que sigue pendiente, y solo estos 5 campos.
  if coalesce(public.app_role(), '') = 'vendedor' then
    if old.estado is distinct from 'pendiente' then
      raise exception 'Esta orden ya no esta pendiente; para corregirla habla con almacen';
    end if;
    if (to_jsonb(old) - array['cliente', 'proyecto', 'nota', 'proveedor', 'numero_pedido_compra'])
       is distinct from
       (to_jsonb(new) - array['cliente', 'proyecto', 'nota', 'proveedor', 'numero_pedido_compra'])
    then
      raise exception 'Un vendedor solo puede corregir cliente, proyecto, nota, proveedor y numero de pedido de compra';
    end if;
  end if;

  return new;
end $$;
