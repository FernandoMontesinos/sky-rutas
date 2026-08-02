"use client";

import { useActionState, useState, startTransition } from "react";
import { Split } from "lucide-react";
import { dividirEnvio, type FormResult } from "../actions";

/**
 * Almacén parte la orden en varios envíos antes de despacharla, cuando sabe de
 * antemano que va a generar más de una guía de remisión. Va detrás de un paso
 * extra porque es la excepción, no lo habitual.
 */
export function DividirEnvioForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(dividirEnvio, {});
  const [nota, setNota] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function confirmar() {
    if (nota.trim().length === 0) {
      setLocalError("Escribe qué queda para el siguiente envío.");
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("nota_pendiente", nota.trim());
    startTransition(() => action(fd));
  }

  const errorMsg = localError ?? state.error;

  return (
    <details className="rounded-xl border border-gray-200 bg-white px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-gray-600">
        <Split className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={2.25} />
        Despachar solo una parte
      </summary>

      <div className="mt-3 space-y-2">
        <label htmlFor="nota_pendiente" className="block text-xs font-medium text-gray-700">
          ¿Qué queda para el siguiente envío? Se crea una orden aparte con eso,
          y esta sigue su curso con lo que sí sale ahora.
        </label>
        <textarea
          id="nota_pendiente"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          placeholder="Ej. Quedan 7 de los 10 ítems, llegan el viernes"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />

        {errorMsg && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{errorMsg}</p>
        )}

        <button
          type="button"
          onClick={confirmar}
          disabled={pending}
          className="w-full rounded-lg border-2 border-sky-600 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 disabled:opacity-50"
        >
          {pending ? "Dividiendo..." : "Crear la orden del resto"}
        </button>
        <p className="text-center text-xs text-gray-500">
          Se puede dividir las veces que haga falta. No cuenta como entrega parcial:
          esto es un despacho planificado, no una falla.
        </p>
      </div>
    </details>
  );
}
