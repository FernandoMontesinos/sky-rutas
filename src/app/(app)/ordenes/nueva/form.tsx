"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { createOrder, type FormResult } from "../actions";
import { buscarCotizacionOdoo } from "./odoo-actions";
import { MultiImagePicker, type PickedImage } from "@/components/multi-image-picker";
import { modalidadLabel, type Modalidad, type OrderType } from "@/lib/types";

const TIPO_LABEL: Record<OrderType, string> = {
  entrega: "Cliente",
  recojo: "Proveedor",
};

export default function NuevaOrdenForm() {
  const [state, action, pending] = useActionState<FormResult, FormData>(createOrder, {});
  const [images, setImages] = useState<PickedImage[]>([]);
  const [tipo, setTipo] = useState<OrderType | "">("");
  const [modalidad, setModalidad] = useState<Modalidad>("reparto");
  const [requiereCompra, setRequiereCompra] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const numeroRef = useRef<HTMLInputElement>(null);
  const clienteRef = useRef<HTMLInputElement>(null);
  const [odoo, setOdoo] = useState<
    { estado: "buscando" } | { estado: "ok"; mensaje: string } | { estado: "error"; mensaje: string } | null
  >(null);

  async function buscarEnOdoo() {
    const numero = numeroRef.current?.value.trim() ?? "";
    if (!numero) {
      setOdoo({ estado: "error", mensaje: "Escribe primero el número de cotización." });
      return;
    }
    setOdoo({ estado: "buscando" });
    const res = await buscarCotizacionOdoo(numero);
    if (!res.ok) {
      setOdoo({ estado: "error", mensaje: res.error });
      return;
    }
    if (clienteRef.current) clienteRef.current.value = res.cliente;
    setOdoo({
      estado: "ok",
      mensaje: `${res.cliente} — S/ ${res.montoTotal.toFixed(2)} — ${res.estado}`,
    });
  }

  const esRecojo = tipo === "recojo";
  const clienteLabel = esRecojo ? "Proveedor" : "Cliente";
  const numeroLabel = tipo === "entrega" ? "N° de cotización" : esRecojo ? "N° de pedido" : "Número de orden / pedido";
  const numeroPlaceholder = tipo === "entrega" ? "Ej. S010222" : esRecojo ? "Ej. P01010" : "Ej. 20613207032";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    if (images.length === 0) {
      setLocalError("Agrega al menos una imagen de la orden.");
      return;
    }
    if (!tipo) {
      setLocalError("Selecciona CLIENTE o PROVEEDOR.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    if (requiereCompra && !String(fd.get("proveedor") ?? "").trim()) {
      setLocalError("Ingresa el nombre del proveedor.");
      return;
    }
    images.forEach((img) => fd.append("imagenes", img.file));
    fd.set("tipo", tipo);
    fd.set("modalidad", modalidad);
    if (requiereCompra) fd.set("requiere_compra", "1");
    startTransition(() => action(fd));
  }

  const errorMsg = localError ?? state.error;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <MultiImagePicker
        label="Imágenes o PDF de la orden"
        images={images}
        onChange={setImages}
        allowPaste
      />

      {/* Número de pedido / cotización (etiqueta según el tipo elegido) */}
      <div>
        <label htmlFor="numero_pedido" className="mb-1 block text-sm font-medium text-gray-700">
          {numeroLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="numero_pedido"
            name="numero_pedido"
            ref={numeroRef}
            required
            placeholder={numeroPlaceholder}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
          {tipo === "entrega" && (
            <button
              type="button"
              onClick={buscarEnOdoo}
              disabled={odoo?.estado === "buscando"}
              className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand hover:text-brand disabled:opacity-60"
            >
              {odoo?.estado === "buscando" ? "Buscando…" : "Buscar en Odoo"}
            </button>
          )}
        </div>
        {odoo && odoo.estado !== "buscando" && (
          <p className={`mt-1 text-xs ${odoo.estado === "ok" ? "text-green-700" : "text-amber-700"}`}>
            {odoo.mensaje}
          </p>
        )}
      </div>

      {/* Cliente / Proveedor (etiqueta según el tipo elegido) */}
      <div>
        <label htmlFor="cliente" className="mb-1 block text-sm font-medium text-gray-700">
          {clienteLabel}
        </label>
        <input
          id="cliente"
          name="cliente"
          ref={clienteRef}
          placeholder={esRecojo ? "Nombre del proveedor" : "Nombre del cliente"}
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
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Proyecto (opcional, solo cuando se atiende a un Cliente) */}
      {tipo === "entrega" && (
        <div>
          <label htmlFor="proyecto" className="mb-1 block text-sm font-medium text-gray-700">
            Proyecto (opcional)
          </label>
          <input
            id="proyecto"
            name="proyecto"
            placeholder="Ej. AREQUIPA, ANTAMINA INGENIERÍA"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
      )}

      {/* Compra a proveedor asociada (solo cuando es Cliente/entrega) */}
      {tipo === "entrega" && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={requiereCompra}
              onChange={(e) => setRequiereCompra(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
            />
            Esta entrega requirió comprar a un proveedor
          </label>

          {requiereCompra && (
            <div className="mt-2 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div>
                <label htmlFor="proveedor" className="mb-1 block text-sm font-medium text-gray-700">
                  Proveedor
                </label>
                <input
                  id="proveedor"
                  name="proveedor"
                  required={requiereCompra}
                  placeholder="Nombre del proveedor"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <div>
                <label
                  htmlFor="numero_pedido_compra"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  N° de pedido de compra (opcional)
                </label>
                <input
                  id="numero_pedido_compra"
                  name="numero_pedido_compra"
                  placeholder="Ej. P01010"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </div>
          )}
        </div>
      )}

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
              {modalidadLabel(m, esRecojo ? "recojo" : "entrega")}
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
