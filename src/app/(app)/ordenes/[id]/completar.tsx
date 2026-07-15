"use client";

import { useActionState, useState, startTransition } from "react";
import { CheckCircle2, AlertTriangle, Camera } from "lucide-react";
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
  const accionParticipio = tipo === "entrega" ? "entregado" : "recogido";
  const errorMsg = localError ?? state.error;

  return (
    <div className="space-y-4 rounded-2xl border border-brand/30 bg-brand/5 p-4">
      <h2 className="flex items-center gap-2 font-semibold text-gray-900">
        <Camera className="h-5 w-5 text-brand" />
        Foto(s) de la guía
      </h2>

      <MultiImagePicker label="" images={images} onChange={setImages} />

      <div>
        <span className="mb-1.5 block text-sm font-medium text-gray-700">
          ¿Cómo quedó la {accion}?
        </span>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setParcial(false)}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-bold transition ${
              !parcial
                ? "border-green-600 bg-green-600 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-green-600"
            }`}
          >
            <CheckCircle2 className="h-5 w-5" />
            Completa
          </button>
          <button
            type="button"
            onClick={() => setParcial(true)}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-bold transition ${
              parcial
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-orange-500"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
            Parcial
          </button>
        </div>
        {parcial && (
          <p className="mt-1.5 text-xs text-orange-700">
            Se marcará como completada, indicando que falta terminar el resto.
          </p>
        )}
      </div>

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
          : `Confirmar ${accion} (marcar como ${accionParticipio}${parcial ? " parcialmente" : ""})`}
      </button>
      <p className="text-center text-xs text-gray-500">
        {TYPE_LABEL[tipo]} · Al confirmar, la orden se marca como completada.
      </p>
    </div>
  );
}
