"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** El repartidor reporta su ubicación actual (se guarda 1 fila por repartidor). */
export async function updateMyLocation(
  lat: number,
  lng: number,
  accuracy?: number
): Promise<{ ok?: boolean; error?: string }> {
  const { userId } = await requireRole(["repartidor", "admin"]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "Coordenadas inválidas." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("repartidor_locations").upsert(
    {
      user_id: userId,
      lat,
      lng,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return { error: error.message };
  return { ok: true };
}
