export type UserRole = "admin" | "vendedor" | "almacen" | "repartidor" | "facturacion";
export type OrderType = "entrega" | "recojo";
export type OrderStatus =
  | "pendiente"
  | "asignado"
  | "en_transito"
  | "completado"
  /** El cliente canceló la OC. La orden queda como registro, fuera del flujo. */
  | "anulado";
export type Modalidad = "reparto" | "oficina" | "courier";
/** Motivo por el que se creó una orden hija (ver `Order.division_tipo`). */
export type DivisionTipo = "remanente" | "envio";

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  activo: boolean;
  created_at: string;
};

export type Order = {
  id: string;
  numero_pedido: string;
  cliente: string | null;
  proyecto: string | null;
  proveedor: string | null;
  numero_pedido_compra: string | null;
  tipo: OrderType;
  estado: OrderStatus;
  modalidad: Modalidad;
  courier_tracking: string | null;
  imagen_url: string | null;
  guia_url: string | null;
  imagenes_urls: string[];
  guias_urls: string[];
  /** Número de guía de remisión, escrito a mano (formato SUNAT, ej. "T002-0001"). */
  numero_guia: string | null;
  /** Fotos opcionales del material/bultos, aparte de la guía en sí. */
  material_urls: string[];
  entrega_parcial: boolean;
  /** Intentos fallidos de recojo: el proveedor no tenía el material listo. */
  no_recogido_intentos: number;
  no_recogido_motivo: string | null;
  no_recogido_at: string | null;
  parent_order_id: string | null;
  /**
   * Por qué existe esta orden hija. "remanente" = faltaron ítems en el punto
   * de entrega (una falla). "envio" = almacén planificó despachar la
   * cotización en varias guías de remisión (una decisión). null = no es hija.
   */
  division_tipo: DivisionTipo | null;
  nota: string | null;
  /** Última observación operativa (recojo o cierre), para cualquier
   *  eventualidad — distinta de `nota`, que es de Ventas. El hilo completo
   *  vive en order_events. */
  observaciones: string | null;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  assigned_at: string | null;
  en_transito_at: string | null;
  completed_at: string | null;
  /** Por qué se anuló (normalmente: el cliente canceló la OC). */
  anulada_motivo: string | null;
  anulada_at: string | null;
  anulada_por: string | null;
};

// Orden con los nombres de las personas relacionadas (vía join).
export type OrderWithNames = Order & {
  creador: { full_name: string } | null;
  repartidor: { full_name: string } | null;
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  almacen: "Almacén",
  repartidor: "Repartidor",
  facturacion: "Facturación",
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  asignado: "Asignado",
  en_transito: "En Tránsito",
  completado: "Completado",
  anulado: "Anulada",
};

export const TYPE_LABEL: Record<OrderType, string> = {
  entrega: "Entrega",
  recojo: "Recojo",
};

export const MODALIDAD_LABEL: Record<Modalidad, string> = {
  reparto: "Reparto (repartidor)",
  oficina: "Recojo en oficina",
  courier: "Courier a Lima",
};

export const DIVISION_LABEL: Record<DivisionTipo, string> = {
  remanente: "Remanente (faltaron ítems)",
  envio: "Envío dividido (planificado)",
};

/** Sufijo del número de la orden hija: S14665-R1 vs S14665-E1. */
export const DIVISION_SUFIJO: Record<DivisionTipo, string> = {
  remanente: "R",
  envio: "E",
};

export const MODALIDAD_SHORT: Record<Modalidad, string> = {
  reparto: "Reparto",
  oficina: "Oficina",
  courier: "Courier",
};

/**
 * Etiqueta completa de la modalidad "oficina" según el tipo de orden:
 * a un Cliente se le entrega en mano cuando "recoge" su pedido; a un
 * Proveedor almacén le "recibe" la mercadería — son acciones distintas
 * aunque la modalidad guardada en la base sea la misma ("oficina").
 * El resto de las modalidades no cambian según el tipo.
 */
export function modalidadLabel(modalidad: Modalidad, tipo: OrderType): string {
  if (modalidad === "oficina") {
    return tipo === "recojo" ? "Recepción en oficina" : "Recojo en oficina";
  }
  return MODALIDAD_LABEL[modalidad];
}
