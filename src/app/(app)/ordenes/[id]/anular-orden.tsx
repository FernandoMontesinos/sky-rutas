"use client";

import { useActionState, useState, startTransition } from "react";
import { Ban } from "lucide-react";
import { anularOrden, type FormResult } from "../actions";

/** Motivo más frecuente, precargado para no tener que escribirlo cada vez. */
const MOTIVO_CLIENTE = "El cliente canceló la OC.";

/**
 * Anular la orden: el cliente canceló la OC. A diferencia de eliminar, la
 * orden se conserva con todo su historial y solo sale de circulación.
 *
 * Va plegado y pide confirmación explícita porque saca la orden del flujo:
 * es reversible en el sentido de que el registro no se pierde, pero no hay
 * un botón para "desanular", así que conviene que sea deliberado.
 */
export function AnularOrdenForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(anularOrden, {});
  const [motivo, setMotivo] = useState(MOTIVO_CLIENTE);
  const [confirmando, setConfirmando] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (motivo.trim().length === 0) {
      setLocalError("Escribe el motivo de la anulación.");
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("motivo", motivo.trim());
    startTransition(() => action(fd));
  }

  const errorMsg = localError ?? state.error;

  return (
    <details
      className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
      onToggle={(e) => setConfirmando((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-gray-700">
        <Ban className="h-4 w-4 text-gray-400" strokeWidth={2.25} />
        Anular orden (el cliente canceló)
      </summary>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <p className="text-xs text-gray-500">
          La orden deja de estar en circulación pero <strong>no se elimina</strong>: queda
          registrada con su historial y el motivo, y se puede consultar en Reportes.
        </p>

        <div>
          <label htmlFor="motivo_anulacion" className="mb-1 block text-xs font-medium text-gray-700">
            Motivo
          </label>
          <textarea
            id="motivo_anulacion"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Ej. El cliente canceló la OC."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {errorMsg && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={pending || !confirmando}
          className="w-full rounded-lg border-2 border-gray-800 bg-gray-800 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:opacity-60"
        >
          {pending ? "Anulando..." : "Confirmar anulación"}
        </button>
      </form>
    </details>
  );
}
