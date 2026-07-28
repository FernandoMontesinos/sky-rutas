"use server";

import { requireRole } from "@/lib/auth";
import { buscarCotizacion, type CompraCandidato } from "@/lib/odoo";

export type BuscarCotizacionResult =
  | {
      ok: true;
      cliente: string;
      montoTotal: number;
      estado: string;
      proyecto: string | null;
      pdfBase64: string | null;
      pdfNombreArchivo: string | null;
      compraCandidatos: CompraCandidato[];
    }
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
      proyecto: cotizacion.proyecto,
      pdfBase64: cotizacion.pdf?.base64 ?? null,
      pdfNombreArchivo: cotizacion.pdf?.nombreArchivo ?? null,
      compraCandidatos: cotizacion.compraCandidatos,
    };
  } catch (err) {
    console.error("Error buscando cotización en Odoo:", err);
    return {
      ok: false,
      error: "No se pudo conectar con Odoo. Puedes seguir llenando el formulario a mano.",
    };
  }
}
