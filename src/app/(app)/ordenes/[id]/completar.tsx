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
  const [faltante, setFaltante] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function confirmar() {
    if (images.length === 0) {
      setLocalError("Primero toma la foto de la guía.");
      return;
    }
    if (parcial && faltante.trim().length === 0) {
      setLocalError("Cuéntanos qué falta — se usa para crear el pedido pendiente restante.");
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("entrega_parcial", String(parcial));
    fd.set("nota_faltante", faltante.trim());
    images.forEach((img) => fd.append("guias", img.file));
    startTransition(() => action(fd));
  }

  const accion = tipo === "entrega" ? "entrega" : "recojo";
  const articulo = tipo === "entrega" ? "la" : "el";
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
          ¿Cómo quedó {articulo} {accion}?
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
          <div className="mt-2 space-y-1.5 rounded-lg border border-orange-200 bg-orange-50 p-3">
            <label htmlFor="nota_faltante" className="block text-xs font-medium text-orange-900">
              ¿Qué falta completar? Con esto se crea el pedido pendiente restante.
            </label>
            <textarea
              id="nota_faltante"
              value={faltante}
              onChange={(e) => setFaltante(e.target.value)}
              rows={2}
              placeholder="Ej. Faltaron 3 cajas, quedaron en almacén del cliente"
              className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
            />
          </div>
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
