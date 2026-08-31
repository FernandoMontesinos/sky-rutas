import { createClient } from "@/lib/supabase/server";

/**
 * Historial de una orden: quién hizo qué y cuándo. Cubre tanto las ediciones
 * de campo como los pasos del flujo, para que el panel cuente la vida
 * completa de la orden en un solo hilo.
 */
export type EventoTipo =
  | "creada"
  | "editada"
  | "asignada"
  | "desasignada"
  | "modalidad"
  | "recogida"
  | "recogida_parcial"
  | "no_recogida"
  | "no_entregado"
  | "dividida"
  | "completada"
  | "parcial"
  | "adjunto_eliminado"
  | "adjunto_agregado"
  | "anulada"
  | "observacion";

export const EVENTO_LABEL: Record<EventoTipo, string> = {
  creada: "Creó la orden",
  editada: "Editó",
  asignada: "Asignó repartidor",
  desasignada: "Quitó el repartidor",
  modalidad: "Cambió la modalidad",
  recogida: "Confirmó",
  // Ya no se genera (el repartidor no decide parcial) — queda solo para que
  // el historial de órdenes viejas siga mostrando una etiqueta legible.
  recogida_parcial: "Recogió parcial — falta coordinar el resto",
  no_recogida: "No se pudo recoger",
  no_entregado: "No se pudo entregar",
  dividida: "Dividió el envío",
  completada: "Cerró la orden",
  parcial: "Cerró la orden como parcial",
  adjunto_eliminado: "Quitó un archivo",
  adjunto_agregado: "Agregó un archivo",
  anulada: "Anuló la orden",
  observacion: "Dejó una observación",
};

/** Etiqueta legible de cada campo editable, para no mostrar el nombre técnico. */
export const CAMPO_LABEL: Record<string, string> = {
  cliente: "Cliente / Proveedor",
  proyecto: "Proyecto",
  nota: "Nota",
  proveedor: "Proveedor de compra",
  numero_pedido_compra: "N° de pedido de compra",
};

export type OrderEvent = {
  id: string;
  tipo: EventoTipo;
  campo: string | null;
  valor_antes: string | null;
  valor_despues: string | null;
  nota: string | null;
  created_at: string;
  autor: { full_name: string } | null;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Registra uno o más eventos. Es "mejor esfuerzo": el historial no debe
 * tumbar la operación que lo genera — si falla, la orden igual cambió. Pero a
 * diferencia de notify(), acá SÍ se mira el error y se deja en el log: un
 * historial con huecos silenciosos es peor que no tenerlo, porque se confía
 * en él.
 */
export async function registrarEventos(
  supabase: Supabase,
  orderId: string,
  eventos: Array<{
    tipo: EventoTipo;
    campo?: string | null;
    valorAntes?: string | null;
    valorDespues?: string | null;
    nota?: string | null;
  }>
) {
  if (eventos.length === 0) return;

  const { error } = await supabase.from("order_events").insert(
    eventos.map((e) => ({
      order_id: orderId,
      tipo: e.tipo,
      campo: e.campo ?? null,
      valor_antes: e.valorAntes ?? null,
      valor_despues: e.valorDespues ?? null,
      nota: e.nota ?? null,
    }))
  );

  if (error) {
    console.error("[historial] no se pudo registrar el evento", {
      orderId,
      tipos: eventos.map((e) => e.tipo),
      code: error.code,
      message: error.message,
    });
  }
}

/** Atajo para el caso más común: un solo evento sin comparación de campos. */
export async function registrarEvento(
  supabase: Supabase,
  orderId: string,
  tipo: EventoTipo,
  nota?: string | null
) {
  await registrarEventos(supabase, orderId, [{ tipo, nota }]);
}
