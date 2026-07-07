"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { createOrder, type FormResult } from "../actions";
import { compressImage } from "@/lib/compress-image";
import type { OrderType } from "@/lib/types";

export default function NuevaOrdenForm() {
  const [state, action, pending] = useActionState<FormResult, FormData>(createOrder, {});
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tipo, setTipo] = useState<OrderType | "">("");
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function applyFile(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setLocalError("El archivo debe ser una imagen.");
      return;
    }
    setLocalError(null);
    const compressed = await compressImage(f);
    setFile(compressed);
    setPreview(URL.createObjectURL(compressed));
  }

  // Permite pegar la imagen con Ctrl+V en cualquier parte de la página.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) {
            applyFile(f);
            e.preventDefault();
          }
          break;
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    if (!file) {
      setLocalError("Pega la imagen de la orden o toma una foto.");
      return;
    }
    if (!tipo) {
      setLocalError("Selecciona ENTREGA o RECOJO.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("imagen", file);
    fd.set("tipo", tipo);
    startTransition(() => action(fd));
  }

  const errorMsg = localError ?? state.error;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Imagen */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Imagen de la orden
        </label>

        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Vista previa de la orden"
              className="max-h-80 w-full rounded-xl border border-gray-200 object-contain bg-white"
            />
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
              className="absolute right-2 top-2 rounded-lg bg-black/60 px-3 py-1 text-sm font-medium text-white"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <>
            {/* PC / tablet: zona para pegar con Ctrl+V */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="hidden w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 py-10 text-center text-gray-500 transition hover:border-brand hover:text-brand sm:flex"
            >
              <span className="text-3xl">📋</span>
              <span className="font-medium">Pega la imagen aquí (Ctrl + V)</span>
              <span className="text-sm">o haz clic para elegir un archivo</span>
            </button>

            {/* Celular: cámara o galería, directo */}
            <div className="grid grid-cols-2 gap-3 sm:hidden">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-3 py-8 text-center text-gray-600 transition active:border-brand active:text-brand"
              >
                <span className="text-3xl">📷</span>
                <span className="text-sm font-semibold">Tomar foto</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-3 py-8 text-center text-gray-600 transition active:border-brand active:text-brand"
              >
                <span className="text-3xl">🖼️</span>
                <span className="text-sm font-semibold">Elegir imagen</span>
              </button>
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
        />
      </div>

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

      {/* Cliente / Proveedor */}
      <div>
        <label htmlFor="cliente" className="mb-1 block text-sm font-medium text-gray-700">
          Cliente / Proveedor
        </label>
        <input
          id="cliente"
          name="cliente"
          placeholder="Nombre del cliente o proveedor"
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
