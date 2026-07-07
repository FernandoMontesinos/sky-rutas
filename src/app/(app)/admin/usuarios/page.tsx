import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, type Profile } from "@/lib/types";
import CrearUsuarioForm from "./crear-form";
import { toggleActivo, deleteUser } from "./actions";

export default async function UsuariosPage() {
  const { userId } = await requireRole(["admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("role")
    .order("full_name");
  const usuarios = (data ?? []) as Profile[];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>

      <CrearUsuarioForm />

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Rol</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 font-medium text-gray-800">{u.full_name}</td>
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
                  {u.id !== userId && (
                    <div className="flex justify-end gap-3">
                      <form action={toggleActivo}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="activo" value={String(u.activo)} />
                        <button className="text-gray-500 hover:text-brand">
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                      <form action={deleteUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="text-gray-400 hover:text-brand">Eliminar</button>
                      </form>
                    </div>
                  )}
                  {u.id === userId && <span className="text-xs text-gray-300">tú</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
