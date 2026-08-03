"use client";

import { useActionState, startTransition } from "react";
import { deleteOrder, type FormResult } from "../actions";

/** Botón de admin para eliminar la orden. Bloqueado en el servidor si tiene
 *  una división (remanente o envío) enlazada — acá solo se muestra el error. */
export function EliminarOrdenButton({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(deleteOrder, {});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  }

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="order_id" value={orderId} />
      {state.error && (
        <p className="mb-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="text-sm text-gray-400 underline hover:text-brand disabled:opacity-60"
      >
        {pending ? "Eliminando..." : "Eliminar orden"}
      </button>
    </form>
  );
}
