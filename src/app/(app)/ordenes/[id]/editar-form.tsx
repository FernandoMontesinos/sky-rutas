"use client";

import { useActionState, useState, startTransition } from "react";
import { Pencil } from "lucide-react";
import { editarOrden, type FormResult } from "../actions";
import type { OrderType } from "@/lib/types";

const CAMPO = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

/**
 * Ventas corrige los datos de una orden que todavía nadie tomó. El número de
 * orden no aparece a propósito: es la identidad del registro y la base lo
 * bloquea aunque alguien intente cambiarlo por fuera.
 */
export function EditarOrdenForm({
  orderId,
  tipo,
  valores,
}: {
  orderId: string;
  tipo: OrderType;
  valores: {
    cliente: string | null;
    proyecto: string | null;
    nota: string | null;
    proveedor: string | null;
    numero_pedido_compra: string | null;
  };
}) {
  const [state, action, pending] = useActionState<FormResult, FormData>(editarOrden, {});
  const [abierto, setAbierto] = useState(false);

  const esCliente = tipo === "entrega";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("order_id", orderId);
    startTransition(() => action(fd));
  }

  return (
    <details
      className="rounded-xl border border-gray-200 bg-white px-3 py-2"
      open={abierto}
      onToggle={(e) => setAbierto((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-gray-600">
        <Pencil className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={2.25} />
        Corregir datos
      </summary>

      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            {esCliente ? "Cliente" : "Proveedor"}
          </label>
          <input name="cliente" defaultValue={valores.cliente ?? ""} className={CAMPO} />
        </div>

        {esCliente && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Proyecto</label>
            <input name="proyecto" defaultValue={valores.proyecto ?? ""} className={CAMPO} />
          </div>
        )}

        {esCliente && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Proveedor de compra
              </label>
              <input name="proveedor" defaultValue={valores.proveedor ?? ""} className={CAMPO} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                N° de pedido de compra
              </label>
              <input
                name="numero_pedido_compra"
                defaultValue={valores.numero_pedido_compra ?? ""}
                className={CAMPO}
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Nota</label>
          <textarea name="nota" rows={2} defaultValue={valores.nota ?? ""} className={CAMPO} />
        </div>

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{state.error}</p>
        )}
        {state.ok && !state.error && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            Guardado. El cambio queda registrado en el historial.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
        <p className="text-center text-xs text-gray-500">
          Queda registrado quién hizo el cambio. El N° de orden no se puede cambiar.
        </p>
      </form>
    </details>
  );
}
