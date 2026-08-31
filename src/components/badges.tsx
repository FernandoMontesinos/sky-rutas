import { Truck, Building2, Package, type LucideIcon } from "lucide-react";
import {
  MODALIDAD_SHORT,
  STATUS_LABEL,
  TYPE_LABEL,
  type Modalidad,
  type OrderStatus,
  type OrderType,
} from "@/lib/types";

export function StatusBadge({
  estado,
  parcial = false,
}: {
  estado: OrderStatus;
  /** Si la orden completada quedó como parcial (falta terminar el resto). */
  parcial?: boolean;
}) {
  const styles: Record<OrderStatus, string> = {
    pendiente: "bg-gray-200 text-gray-700",
    asignado: "bg-amber-100 text-amber-800",
    en_transito: "bg-sky-100 text-sky-800",
    completado: "bg-green-100 text-green-800",
    // Neutro y tachado: una orden anulada no es un error ni un pendiente,
    // es un registro histórico que quedó fuera de circulación.
    anulado: "bg-gray-300 text-gray-600 line-through",
  };
  if (estado === "completado" && parcial) {
    return (
      <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-800">
        Completado (parcial)
      </span>
    );
  }
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

export function ModalidadBadge({ modalidad }: { modalidad: Modalidad }) {
  const styles: Record<Modalidad, string> = {
    reparto: "bg-blue-100 text-blue-800",
    oficina: "bg-purple-100 text-purple-800",
    courier: "bg-orange-100 text-orange-800",
  };
  const Icon: Record<Modalidad, LucideIcon> = {
    reparto: Truck,
    oficina: Building2,
    courier: Package,
  };
  const IconComp = Icon[modalidad];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[modalidad]}`}
    >
      <IconComp className="h-3 w-3" strokeWidth={2.5} />
      {MODALIDAD_SHORT[modalidad]}
    </span>
  );
}
