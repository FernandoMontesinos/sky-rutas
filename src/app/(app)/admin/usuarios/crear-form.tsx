"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUser, type FormResult } from "./actions";
import { ROLE_LABEL, type UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["vendedor", "almacen", "repartidor", "admin", "facturacion"];

export default function CrearUsuarioForm() {
  const [state, action, pending] = useActionState<FormResult, FormData>(createUser, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
    >
      <h2 className="font-semibold text-gray-900">Crear usuario</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="full_name"
          required
          placeholder="Nombre completo"
          className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Correo"
          className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
        />
        <input
          name="password"
          type="text"
          required
          placeholder="Contraseña (mín. 6)"
          className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
        />
        <select
          name="role"
          defaultValue="vendedor"
          className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.ok}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Creando..." : "Crear usuario"}
      </button>
    </form>
  );
}
