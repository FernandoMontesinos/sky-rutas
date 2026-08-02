-- =====================================================================
-- SkyHigh Rutas — Arreglo de la política de UPDATE sobre orders
-- Encontrado al probar "no se recogió" con la cuenta real de un
-- repartidor, 2026-08-01.
--
-- La política `orders_update` (ver 13_rls_creador_update.sql) declaraba
-- solo USING, sin WITH CHECK. Cuando falta WITH CHECK, Postgres reusa la
-- expresión del USING para validar también la fila RESULTANTE.
--
-- Eso rompía el flujo nuevo: al registrar "no se recogió", el repartidor
-- devuelve la orden a `pendiente` y se quita a sí mismo de `assigned_to`
-- (misma regla que ya usa desasignar: pendiente = sin repartidor). Como
-- la fila nueva ya no cumplía `assigned_to = auth.uid()`, el UPDATE se
-- rechazaba con "new row violates row-level security policy".
--
-- El USING no se toca: ahí sigue el control real de QUÉ filas puede tocar
-- cada quien. El WITH CHECK solo deja de exigirle al repartidor que siga
-- asignado después del cambio.
-- Ejecutar UNA VEZ en Supabase -> SQL Editor.
-- =====================================================================

drop policy if exists orders_update on public.orders;

create policy orders_update on public.orders
  for update
  using (
    (app_role() = ANY (ARRAY['admin', 'almacen']))
    OR (app_role() = 'repartidor' AND assigned_to = auth.uid())
    OR created_by = auth.uid()
  )
  with check (
    (app_role() = ANY (ARRAY['admin', 'almacen']))
    OR (app_role() = 'repartidor')
    OR created_by = auth.uid()
  );
