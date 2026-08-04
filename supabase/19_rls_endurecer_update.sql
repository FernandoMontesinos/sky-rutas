-- =====================================================================
-- SkyHigh Rutas — Endurecer la política de UPDATE sobre orders
-- 2026-08-01. Corrige dos agujeros que dejó 17_rls_update_with_check.sql.
--
-- 1) WITH CHECK demasiado suelto para el repartidor.
--    Decía solo `app_role() = 'repartidor'`, sin ninguna condición. USING
--    mira la fila VIEJA (qué filas puedo tocar); WITH CHECK mira la fila
--    NUEVA (en qué la puedo convertir). Con el check incondicional, un
--    repartidor podía tomar una orden asignada a él y convertirla en lo
--    que quisiera: ponerse como `created_by` (y quedarse con permiso
--    permanente sobre ella aunque después se la reasignaran a otro), o
--    reasignársela a un tercero.
--
--    Se repite la condición real y se agrega explícitamente el único caso
--    legítimo que obligó a aflojarla en su momento: al registrar "no se
--    recogió" el repartidor devuelve la orden a pendientes y se quita a sí
--    mismo, dejando `assigned_to = null`.
--
-- 2) Se perdió la cláusula `to authenticated`.
--    El schema original la tenía (schema.sql, política orders_update); al
--    reescribir la política en 13_ y 17_ se omitió, así que quedó
--    aplicando a PUBLIC — que incluye el rol `anon`. Hoy no hay fuga real
--    porque todas las ramas del USING exigen `auth.uid()`, pero es una red
--    de seguridad que no debería faltar.
--
-- Nota: el resto de las políticas del repo tienen el mismo detalle (ver
-- 09_notificaciones.sql y 11_rls_backorder.sql, creadas sin `to`). No se
-- tocan acá para no mezclar cambios; queda anotado como pendiente.
-- Ejecutar UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

drop policy if exists orders_update on public.orders;

create policy orders_update on public.orders
  for update to authenticated
  using (
    (app_role() = ANY (ARRAY['admin', 'almacen']))
    OR (app_role() = 'repartidor' AND assigned_to = auth.uid())
    OR created_by = auth.uid()
  )
  with check (
    (app_role() = ANY (ARRAY['admin', 'almacen']))
    OR (app_role() = 'repartidor' AND (assigned_to = auth.uid() OR assigned_to IS NULL))
    OR created_by = auth.uid()
  );
