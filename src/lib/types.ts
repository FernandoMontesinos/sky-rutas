export type UserRole = "admin" | "vendedor" | "almacen" | "repartidor";
export type OrderType = "entrega" | "recojo";
export type OrderStatus = "pendiente" | "asignado" | "completado";

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
  tipo: OrderType;
  estado: OrderStatus;
  imagen_url: string | null;
  guia_url: string | null;
  nota: string | null;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  assigned_at: string | null;
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
  completado: "Completado",
};

export const TYPE_LABEL: Record<OrderType, string> = {
  entrega: "Entrega",
  recojo: "Recojo",
};
