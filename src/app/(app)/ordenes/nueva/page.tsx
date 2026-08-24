import { requireRole } from "@/lib/auth";
import NuevaOrdenForm from "./form";

export default async function NuevaOrdenPage() {
  await requireRole(["vendedor", "almacen", "admin"]);
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Nueva orden</h1>
      <NuevaOrdenForm />
    </div>
  );
}
