"use client";

import { useState, useTransition } from "react";
import { updateModalidad } from "../actions";
import { MODALIDAD_LABEL, type Modalidad } from "@/lib/types";

/** Modalidad de entrega con autoguardado (sin botón: se guarda al elegir/salir del campo). */
export function ModalidadForm({
  orderId,
  modalidad,
  courierTracking,
}: {
  orderId: string;
  modalidad: Modalidad;
  courierTracking: string | null;
}) {
  const [valor, setValor] = useState<Modalidad>(modalidad);
  const [tracking, setTracking] = useState(courierTracking ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function guardar(nextModalidad: Modalidad, nextTracking: string) {
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("modalidad", nextModalidad);
    fd.set("courier_tracking", nextTracking);
    startTransition(async () => {
      await updateModalidad(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
      <label htmlFor="modalidad" className="block text-sm font-medium text-gray-700">
        Modalidad de entrega
      </label>
      <select
        id="modalidad"
        value={valor}
        onChange={(e) => {
          const next = e.target.value as Modalidad;
          setValor(next);
          guardar(next, tracking);
        }}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
      >
        {(["reparto", "oficina", "courier"] as Modalidad[]).map((m) => (
          <option key={m} value={m}>
            {MODALIDAD_LABEL[m]}
          </option>
        ))}
      </select>
      {valor === "courier" && (
        <input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          onBlur={() => guardar(valor, tracking)}
          placeholder="N° de tracking (solo si es Courier)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
        />
      )}
      <p className="h-4 text-xs text-gray-400">
        {pending ? "Guardando..." : saved ? "✓ Guardado" : ""}
      </p>
    </div>
  );
}
