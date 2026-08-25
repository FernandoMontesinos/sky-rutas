"use client";

import { useActionState, useState, startTransition } from "react";
import { Paperclip } from "lucide-react";
import { agregarAdjuntos, type FormResult } from "../actions";
import { MultiImagePicker, type PickedImage } from "@/components/multi-image-picker";

/**
 * Vuelve a subir el PDF/imagen de una orden ya creada. Antes se podía quitar
 * el archivo equivocado con la "×" pero no cargar el correcto, y la única
 * salida era borrar la orden y rehacerla.
 *
 * Se muestra plegado para no competir con el documento cuando no hace falta:
 * lo normal es consultar la orden, no cambiarle el adjunto.
 */
export function AgregarAdjuntosForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(agregarAdjuntos, {});
  const [images, setImages] = useState<PickedImage[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    if (images.length === 0) {
      setLocalError("Elige al menos un archivo.");
      return;
    }
    const fd = new FormData();
    fd.set("order_id", orderId);
    images.forEach((img) => fd.append("imagenes", img.file));
    startTransition(() => action(fd));
  }

  const errorMsg = localError ?? state.error;

  return (
    <details className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-gray-700">
        <Paperclip className="h-4 w-4 text-gray-400" strokeWidth={2.25} />
        Agregar imagen o PDF de la orden
      </summary>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <MultiImagePicker
          label="Nuevos archivos"
          images={images}
          onChange={setImages}
          allowPaste
        />

        {errorMsg && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Subiendo..." : "Subir archivos"}
        </button>
      </form>
    </details>
  );
}
