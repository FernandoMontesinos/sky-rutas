export type UserRole = "admin" | "vendedor" | "almacen" | "repartidor";
export type OrderType = "entrega" | "recojo";
export type OrderStatus = "pendiente" | "asignado" | "en_transito" | "completado";
export type Modalidad = "reparto" | "oficina" | "courier";

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
  entrega_parcial: boolean;
  parent_order_id: string | null;
  nota: string | null;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  assigned_at: string | null;
  en_transito_at: string | null;
  completed_at: string | null;
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
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  asignado: "Asignado",
  en_transito: "En Tránsito",
  completado: "Completado",
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
