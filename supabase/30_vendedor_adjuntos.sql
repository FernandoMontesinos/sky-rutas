-- =====================================================================
-- SkyHigh Rutas — El adjunto de la orden también es de Ventas
-- 2026-08-03.
--
-- Regresión introducida el mismo día por 26_orders_vendedor_solo_pendiente:
-- ese trigger dejó a los vendedores con permiso para tocar únicamente
-- cliente/proyecto/nota/proveedor/numero_pedido_compra. Pero quitar el PDF
-- o la foto de una orden (eliminarAdjunto en actions.ts) escribe
-- imagen_url/imagenes_urls, así que a un vendedor le empezó a saltar la
-- excepción del trigger al pulsar la "×" del adjunto.
--
-- Se suman esas dos columnas a la lista blanca: el documento de la
-- cotización/pedido es parte de los datos de la venta, igual que el resto,
-- y es justamente Ventas quien lo carga al crear la orden. El límite de
-- "solo mientras esté pendiente" se mantiene tal cual.
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
  -- tocar una orden que sigue pendiente, y solo estos campos (los 5 que
  -- edita el formulario + el adjunto de la orden, que también es suyo).
  if coalesce(public.app_role(), '') = 'vendedor' then
    if old.estado is distinct from 'pendiente' then
      raise exception 'Esta orden ya no esta pendiente; para corregirla habla con almacen';
    end if;
    if (to_jsonb(old) - array['cliente', 'proyecto', 'nota', 'proveedor', 'numero_pedido_compra', 'imagen_url', 'imagenes_urls'])
       is distinct from
       (to_jsonb(new) - array['cliente', 'proyecto', 'nota', 'proveedor', 'numero_pedido_compra', 'imagen_url', 'imagenes_urls'])
    then
      raise exception 'Un vendedor solo puede corregir los datos y el adjunto de la orden';
    end if;
  end if;

  return new;
end $$;
