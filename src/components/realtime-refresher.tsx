"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Refresca la página automáticamente cuando cambia algo en `orders`
 * (creada, asignada, completada), para que otros usuarios con la pantalla
 * abierta (ej. almacén viendo el tablero) vean el cambio sin recargar.
 * Sin esto, cada navegador solo ve datos frescos en su propia sesión.
 *
 * Nota (2026-07-15): la suscripción conecta (SUBSCRIBED) y queda
 * registrada en `realtime.subscription`, pero en pruebas locales no
 * llegó a entregar eventos de postgres_changes pese a permisos y
 * publicación correctos. Puede ser una demora de propagación de
 * Supabase tras activar la publicación recién hoy. Verificar en
 * producción antes de asumir que ya funciona.
 */
export function RealtimeRefresher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
