"use client";

import { useActionState, useState, startTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { actualizarUsuario, toggleActivo, deleteUser, type FormResult } from "./actions";
import { ROLE_LABEL, type Profile, type UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["admin", "vendedor", "almacen", "repartidor", "facturacion"];

/**
 * Eliminar usuario, con confirmación de por medio: antes un solo clic en
 * "Eliminar" borraba la cuenta sin preguntar nada — un mal clic en una tabla
 * densa (como esta) era demasiado fácil y no había vuelta atrás.
 */
function EliminarUsuarioButton({ id, nombre }: { id: string; nombre: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  function confirmar() {
    setEliminando(true);
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      deleteUser(fd);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-gray-400 transition hover:text-brand"
      >
        Eliminar
      </button>

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/30"
            onClick={() => !eliminando && setConfirmando(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-eliminar-titulo"
            className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 id="confirmar-eliminar-titulo" className="text-base font-bold text-gray-900">
              ¿Eliminar a {nombre}?
            </h3>
            <p className="mt-1.5 text-sm text-gray-500">
              Esta acción no se puede deshacer. {nombre} pierde el acceso de inmediato.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={eliminando}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={eliminando}
                className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
              >
                {eliminando ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Una fila de la tabla de usuarios, que se convierte en formulario al tocar
 * "Editar". Se edita en el sitio en vez de abrir otra pantalla porque el
 * cambio típico es de un campo (un apellido mal escrito, alguien que pasa de
 * vendedor a almacén) y así se ve el resto de la lista como referencia.
 */
export function FilaUsuario({ u, esYo }: { u: Profile; esYo: boolean }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(actualizarUsuario, {});
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(u.full_name);
  const [rol, setRol] = useState<UserRole>(u.role);

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("id", u.id);
    fd.set("full_name", nombre.trim());
    fd.set("role", rol);
    startTransition(async () => {
      action(fd);
      setEditando(false);
    });
  }

  function cancelar() {
    setNombre(u.full_name);
    setRol(u.role);
    setEditando(false);
  }

  if (editando) {
    return (
      <tr className="bg-brand/5">
        <td colSpan={4} className="px-4 py-3">
          <form onSubmit={guardar} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-600">Nombre</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Rol</label>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as UserRole)}
                disabled={esYo}
                title={esYo ? "No puedes cambiarte el rol a ti mismo" : undefined}
                className="rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:border-brand disabled:bg-gray-100 disabled:text-gray-400"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
              {pending ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={cancelar}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-brand"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
              Cancelar
            </button>
          </form>
          {esYo && (
            <p className="mt-1.5 text-xs text-gray-500">
              Puedes corregir tu nombre, pero no cambiarte el rol: si te quitas el de
              administrador, nadie podría volver a entrar acá a devolvértelo.
            </p>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-2 font-medium text-gray-800">
        {u.full_name}
        {state.error && <span className="ml-2 text-xs text-brand-dark">{state.error}</span>}
      </td>
      <td className="px-4 py-2 text-gray-600">{ROLE_LABEL[u.role]}</td>
      <td className="px-4 py-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            u.activo ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-500"
          }`}
        >
          {u.activo ? "Activo" : "Inactivo"}
        </span>
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="flex items-center gap-1 text-gray-500 transition hover:text-brand"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
            Editar
          </button>

          {esYo ? (
            <span className="text-xs text-gray-300">tú</span>
          ) : (
            <>
              <form action={toggleActivo}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="activo" value={String(u.activo)} />
                <button className="text-gray-500 transition hover:text-brand">
                  {u.activo ? "Desactivar" : "Activar"}
                </button>
              </form>
              <EliminarUsuarioButton id={u.id} nombre={u.full_name} />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
