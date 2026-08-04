import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import CrearUsuarioForm from "./crear-form";
import { FilaUsuario } from "./fila-usuario";

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
              <FilaUsuario key={u.id} u={u} esYo={u.id === userId} />
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
