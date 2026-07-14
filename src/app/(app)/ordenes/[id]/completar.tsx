"use client";

import { useActionState, useState, startTransition } from "react";
import { completeOrder, type FormResult } from "../actions";
import { MultiImagePicker, type PickedImage } from "@/components/multi-image-picker";
import { TYPE_LABEL, type OrderType } from "@/lib/types";

export default function CompletarForm({
  orderId,
  tipo,
}: {
  orderId: string;
  tipo: OrderType;
}) {
  const [state, action, pending] = useActionState<FormResult, FormData>(
    completeOrder,
    {}
  );
  const [images, setImages] = useState<PickedImage[]>([]);
  const [parcial, setParcial] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function confirmar() {
    if (images.length === 0) {
      setLocalError("Primero toma la foto de la guía.");
      return;
    }
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("entrega_parcial", String(parcial));
    images.forEach((img) => fd.append("guias", img.file));
    startTransition(() => action(fd));
  }

  const accion = tipo === "entrega" ? "entrega" : "recojo";
  const errorMsg = localError ?? state.error;

  return (
    <div className="space-y-3 rounded-2xl border border-brand/30 bg-brand/5 p-4">
      <h2 className="font-semibold text-gray-900">Foto(s) de la guía</h2>

      <MultiImagePicker label="" images={images} onChange={setImages} />

      <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={parcial}
          onChange={(e) => setParcial(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
        />
        Fue una {accion} <b>parcial</b> (falta completar el resto)
      </label>

      {errorMsg && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{errorMsg}</p>
      )}

      <button
        type="button"
        onClick={confirmar}
        disabled={pending || images.length === 0}
        className="w-full rounded-lg bg-brand py-3 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {pending
          ? "Confirmando..."
          : `Confirmar ${accion} (marcar como ${
              tipo === "entrega" ? "entregado" : "recogido"
            }${parcial ? " parcialmente" : ""})`}
      </button>
      <p className="text-center text-xs text-gray-500">
        {TYPE_LABEL[tipo]} · Al confirmar, la orden se marca como completada.
      </p>
    </div>
  );
}
