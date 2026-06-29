"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { completeOrder, type FormResult } from "../actions";
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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function applyFile(f: File | null) {
    if (!f) return;
    setLocalError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function confirmar() {
    if (!file) {
      setLocalError("Primero toma la foto de la guía.");
      return;
    }
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("guia", file);
    startTransition(() => action(fd));
  }

  const accion = tipo === "entrega" ? "entrega" : "recojo";
  const errorMsg = localError ?? state.error;

  return (
    <div className="space-y-3 rounded-2xl border border-brand/30 bg-brand/5 p-4">
      <h2 className="font-semibold text-gray-900">Foto de la guía</h2>

      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Foto de la guía"
            className="max-h-80 w-full rounded-xl border border-gray-200 object-contain bg-white"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute right-2 top-2 rounded-lg bg-black/60 px-3 py-1 text-sm font-medium text-white"
          >
            Repetir
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/40 bg-white px-4 py-10 text-center text-brand"
        >
          <span className="text-3xl">📷</span>
          <span className="font-semibold">Tomar foto de la guía</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => applyFile(e.target.files?.[0] ?? null)}
      />

      {errorMsg && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{errorMsg}</p>
      )}

      <button
        type="button"
        onClick={confirmar}
        disabled={pending || !file}
        className="w-full rounded-lg bg-brand py-3 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {pending
          ? "Confirmando..."
          : `Confirmar ${accion} (marcar como ${
              tipo === "entrega" ? "entregado" : "recogido"
            })`}
      </button>
      <p className="text-center text-xs text-gray-500">
        {TYPE_LABEL[tipo]} · Al confirmar, la orden se marca como completada.
      </p>
    </div>
  );
}
