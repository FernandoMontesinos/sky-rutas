"use client";

import { useState, useTransition } from "react";
import { assignOrder } from "../actions";
import { SavedIndicator } from "@/components/saved-indicator";
import type { Profile } from "@/lib/types";

/** Asignación a repartidor con autoguardado (sin botón: se guarda al elegir). */
export function AsignarForm({
  orderId,
  assignedTo,
  repartidores,
}: {
  orderId: string;
  assignedTo: string | null;
  repartidores: Profile[];
}) {
  const [valor, setValor] = useState(assignedTo ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function guardar(next: string) {
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("repartidor_id", next);
    startTransition(async () => {
      await assignOrder(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
      <label htmlFor="repartidor_id" className="block text-sm font-medium text-gray-700">
        Asignar a repartidor
      </label>
      <select
        id="repartidor_id"
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          guardar(e.target.value);
        }}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
      >
        <option value="">— Sin asignar —</option>
        {repartidores.map((r) => (
          <option key={r.id} value={r.id}>
            {r.full_name}
          </option>
        ))}
      </select>
      <SavedIndicator pending={pending} saved={saved} />
      {repartidores.length === 0 && (
        <p className="text-xs text-amber-700">
          No hay repartidores activos. Crea usuarios con rol repartidor en Usuarios.
        </p>
      )}
    </div>
  );
}
