"use client";

import { useActionState } from "react";
import { cambiarPassword, type CambiarPasswordState } from "./actions";

const initialState: CambiarPasswordState = {};

export default function CambiarPasswordForm() {
  const [state, action, pending] = useActionState(cambiarPassword, initialState);

  return (
    <form action={action} className="max-w-sm space-y-4 rounded-2xl bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="actual" className="mb-1 block text-sm font-medium text-gray-700">
          Contraseña actual
        </label>
        <input
          id="actual"
          name="actual"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div>
        <label htmlFor="nueva" className="mb-1 block text-sm font-medium text-gray-700">
          Contraseña nueva
        </label>
        <input
          id="nueva"
          name="nueva"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Mín. 6 caracteres"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div>
        <label htmlFor="confirmar" className="mb-1 block text-sm font-medium text-gray-700">
          Confirmar contraseña nueva
        </label>
        <input
          id="confirmar"
          name="confirmar"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          Contraseña actualizada.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}
