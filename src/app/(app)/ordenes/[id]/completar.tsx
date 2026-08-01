"use client";

import { useActionState, useState, startTransition } from "react";
import { CheckCircle2, AlertTriangle, Camera, Truck } from "lucide-react";
import { completeOrder, marcarEnTransito, type FormResult } from "../actions";
import { MultiImagePicker, type PickedImage } from "@/components/multi-image-picker";
import { TYPE_LABEL, type OrderType } from "@/lib/types";

/**
 * Paso 1 de un Pedido (Proveedor): el repartidor sube la guía y confirma que
 * recogió el material. A propósito NO se le pregunta completa/parcial — él
 * recibe bultos sellados y no cuenta los ítems. La orden queda "En Tránsito"
 * y la cierra quien cuente la mercadería (ver CompletarForm).
 */
export function RecojoForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(marcarEnTransito, {});
  const [images, setImages] = useState<PickedImage[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  function confirmar() {
    if (images.length === 0) {
      setLocalError("Primero toma la foto de la guía.");
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.set("order_id", orderId);
    images.forEach((img) => fd.append("guias", img.file));
    startTransition(() => action(fd));
  }

  const errorMsg = localError ?? state.error;

  return (
    <div className="space-y-4 rounded-2xl border border-sky-300 bg-sky-50 p-4">
      <h2 className="flex items-center gap-2 font-semibold text-gray-900">
        <Camera className="h-5 w-5 text-sky-700" />
        Foto(s) de la guía del proveedor
      </h2>

      <MultiImagePicker label="" images={images} onChange={setImages} />

      {errorMsg && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{errorMsg}</p>
      )}

      <button
        type="button"
        onClick={confirmar}
        disabled={pending || images.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-700 py-3 font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50"
      >
        <Truck className="h-5 w-5" />
        {pending ? "Confirmando..." : "Confirmar recojo"}
      </button>
      <p className="text-center text-xs text-gray-600">
        Solo confirmas que recogiste el material. No hace falta que cuentes los ítems —
        la orden queda <strong>En Tránsito</strong> hasta que se verifique la cantidad.
      </p>
    </div>
  );
}

/**
 * Cierre de la orden: lo hace quien CONTÓ la mercadería. En una entrega a
 * cliente es el repartidor (el cliente cuenta y firma delante suyo); en un
 * pedido que llega al depósito es almacén; en un pedido que va directo del
 * proveedor al cliente vuelve a ser el repartidor.
 */
export default function CompletarForm({
  orderId,
  tipo,
  verificando = false,
}: {
  orderId: string;
  tipo: OrderType;
  /** La orden ya venía "En Tránsito": la guía se subió al recoger, así que
   *  acá la foto es opcional y el texto habla de verificar, no de entregar. */
  verificando?: boolean;
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
    if (!verificando && images.length === 0) {
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
        {verificando ? "Foto(s) adicionales (opcional)" : "Foto(s) de la guía"}
      </h2>

      <MultiImagePicker label="" images={images} onChange={setImages} />

      <div>
        <span className="mb-1.5 block text-sm font-medium text-gray-700">
          {verificando
            ? "Después de contar los ítems, ¿cómo llegó?"
            : `¿Cómo quedó ${articulo} ${accion}?`}
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
        disabled={pending || (!verificando && images.length === 0)}
        className="w-full rounded-lg bg-brand py-3 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {pending
          ? "Confirmando..."
          : verificando
            ? `Cerrar orden (llegó ${parcial ? "parcial" : "completa"})`
            : `Confirmar ${accion} (marcar como ${accionParticipio}${parcial ? " parcialmente" : ""})`}
      </button>
      <p className="text-center text-xs text-gray-500">
        {TYPE_LABEL[tipo]} · Al confirmar, la orden se marca como completada.
      </p>
    </div>
  );
}
