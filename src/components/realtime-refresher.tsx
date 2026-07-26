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
 * Confirmado funcionando (2026-07-22): probado en vivo con dos sesiones
 * reales contra Supabase — un INSERT en `orders` llegó al tablero abierto
 * sin recargar. La demora inicial reportada el 2026-07-15 era solo de
 * propagación por ser la primera activación de Realtime en el proyecto.
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
