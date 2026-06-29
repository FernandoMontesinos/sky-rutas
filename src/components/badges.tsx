import {
  STATUS_LABEL,
  TYPE_LABEL,
  type OrderStatus,
  type OrderType,
} from "@/lib/types";

export function StatusBadge({ estado }: { estado: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    pendiente: "bg-gray-200 text-gray-700",
    asignado: "bg-amber-100 text-amber-800",
    completado: "bg-green-100 text-green-800",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[estado]}`}>
      {STATUS_LABEL[estado]}
    </span>
  );
}

export function TypeBadge({ tipo }: { tipo: OrderType }) {
  const styles: Record<OrderType, string> = {
    entrega: "bg-brand/10 text-brand",
    recojo: "bg-gray-800 text-white",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${styles[tipo]}`}>
      {TYPE_LABEL[tipo]}
    </span>
  );
}
