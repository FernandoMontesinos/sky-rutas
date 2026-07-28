"use server";

import { requireRole } from "@/lib/auth";
import { buscarCotizacion } from "@/lib/odoo";

export type BuscarCotizacionResult =
  | { ok: true; cliente: string; montoTotal: number; estado: string }
  | { ok: false; error: string };

/** Busca una cotización en Odoo por número para autocompletar el formulario. */
export async function buscarCotizacionOdoo(numero: string): Promise<BuscarCotizacionResult> {
  await requireRole(["vendedor", "admin"]);

  try {
    const cotizacion = await buscarCotizacion(numero);
    if (!cotizacion) {
      return { ok: false, error: `No se encontró la cotización "${numero}" en Odoo.` };
    }
    return {
      ok: true,
      cliente: cotizacion.cliente,
      montoTotal: cotizacion.montoTotal,
      estado: cotizacion.estado,
    };
  } catch (err) {
    console.error("Error buscando cotización en Odoo:", err);
    return {
      ok: false,
      error: "No se pudo conectar con Odoo. Puedes seguir llenando el formulario a mano.",
    };
  }
}
