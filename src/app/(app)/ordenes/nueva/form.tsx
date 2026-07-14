"use client";

import { useActionState, useState, startTransition } from "react";
import { createOrder, type FormResult } from "../actions";
import { MultiImagePicker, type PickedImage } from "@/components/multi-image-picker";
import { MODALIDAD_LABEL, type Modalidad, type OrderType } from "@/lib/types";

export default function NuevaOrdenForm() {
  const [state, action, pending] = useActionState<FormResult, FormData>(createOrder, {});
  const [images, setImages] = useState<PickedImage[]>([]);
  const [tipo, setTipo] = useState<OrderType | "">("");
  const [modalidad, setModalidad] = useState<Modalidad>("reparto");
  const [localError, setLocalError] = useState<string | null>(null);

  const proveedorLabel = tipo === "recojo" ? "Proveedor (de dónde se compra)" : "Cliente";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    if (images.length === 0) {
      setLocalError("Agrega al menos una imagen de la orden.");
      return;
    }
    if (!tipo) {
      setLocalError("Selecciona ENTREGA o RECOJO.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    images.forEach((img) => fd.append("imagenes", img.file));
    fd.set("tipo", tipo);
    fd.set("modalidad", modalidad);
    startTransition(() => action(fd));
  }

  const errorMsg = localError ?? state.error;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <MultiImagePicker
        label="Imágenes de la orden"
        images={images}
        onChange={setImages}
        allowPaste
      />

      {/* Número de pedido */}
      <div>
        <label htmlFor="numero_pedido" className="mb-1 block text-sm font-medium text-gray-700">
          Número de orden / pedido
        </label>
        <input
          id="numero_pedido"
          name="numero_pedido"
          required
          placeholder="Ej. 20613207032"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>

      {/* Cliente / Proveedor (etiqueta según el tipo elegido) */}
      <div>
        <label htmlFor="cliente" className="mb-1 block text-sm font-medium text-gray-700">
          {proveedorLabel}
        </label>
        <input
          id="cliente"
          name="cliente"
          placeholder={tipo === "recojo" ? "Nombre del proveedor" : "Nombre del cliente"}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>

      {/* Tipo */}
      <div>
        <span className="mb-1 block text-sm font-medium text-gray-700">Tipo</span>
        <div className="grid grid-cols-2 gap-3">
          {(["entrega", "recojo"] as OrderType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`rounded-xl border-2 py-3 font-bold uppercase transition ${
                tipo === t
                  ? "border-brand bg-brand text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-brand"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Modalidad de entrega */}
      <div>
        <label htmlFor="modalidad" className="mb-1 block text-sm font-medium text-gray-700">
          Modalidad de entrega
        </label>
        <select
          id="modalidad"
          value={modalidad}
          onChange={(e) => setModalidad(e.target.value as Modalidad)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
        >
          {(["reparto", "oficina", "courier"] as Modalidad[]).map((m) => (
            <option key={m} value={m}>
              {MODALIDAD_LABEL[m]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">
          Almacén puede corregir esto después si hace falta.
        </p>
      </div>

      {modalidad === "courier" && (
        <div>
          <label
            htmlFor="courier_tracking"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            N° de tracking del courier (opcional)
          </label>
          <input
            id="courier_tracking"
            name="courier_tracking"
            placeholder="Ej. TR-00123"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
      )}

      {/* Nota */}
      <div>
        <label htmlFor="nota" className="mb-1 block text-sm font-medium text-gray-700">
          Nota (opcional)
        </label>
        <textarea
          id="nota"
          name="nota"
          rows={2}
          placeholder="Indicaciones para almacén o el repartidor"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>

      {errorMsg && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand py-3 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar orden"}
      </button>
    </form>
  );
}
