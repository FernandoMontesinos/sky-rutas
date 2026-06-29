import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, TypeBadge } from "@/components/badges";
import { assignOrder, deleteOrder } from "../actions";
import CompletarForm from "./completar";
import type { OrderWithNames, Profile } from "@/lib/types";

const SELECT =
  "*, creador:profiles!orders_created_by_fkey(full_name), repartidor:profiles!orders_assigned_to_fkey(full_name)";

function fmt(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function OrdenDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, profile } = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase.from("orders").select(SELECT).eq("id", id).single();
  if (!data) notFound();
  const order = data as unknown as OrderWithNames;

  const canAssign = profile.role === "admin" || profile.role === "almacen";
  const isMine = order.assigned_to === userId;
  const canComplete =
    order.estado !== "completado" &&
    (profile.role === "admin" || (profile.role === "repartidor" && isMine));

  let repartidores: Profile[] = [];
  if (canAssign) {
    const { data: reps } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "repartidor")
      .eq("activo", true)
      .order("full_name");
    repartidores = (reps ?? []) as Profile[];
  }

  return (
    <div className="space-y-5">
      <Link href="/ordenes" className="text-sm text-gray-500 hover:text-brand">
        ‹ Volver a órdenes
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-900">#{order.numero_pedido}</h1>
        <TypeBadge tipo={order.tipo} />
        <StatusBadge estado={order.estado} />
      </div>

      {/* Imagen de la orden */}
      {order.imagen_url && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-gray-500">Orden</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={order.imagen_url}
            alt="Imagen de la orden"
            className="w-full rounded-xl border border-gray-200 bg-white object-contain"
          />
        </div>
      )}

      {/* Datos */}
      <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <div>
          <dt className="text-gray-400">Creada por</dt>
          <dd className="font-medium text-gray-800">{order.creador?.full_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Repartidor</dt>
          <dd className="font-medium text-gray-800">{order.repartidor?.full_name ?? "Sin asignar"}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Creada</dt>
          <dd className="font-medium text-gray-800">{fmt(order.created_at)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Completada</dt>
          <dd className="font-medium text-gray-800">{fmt(order.completed_at) ?? "—"}</dd>
        </div>
        {order.nota && (
          <div className="col-span-2">
            <dt className="text-gray-400">Nota</dt>
            <dd className="font-medium text-gray-800">{order.nota}</dd>
          </div>
        )}
      </dl>

      {/* Asignar (almacén/admin) */}
      {canAssign && order.estado !== "completado" && (
        <form action={assignOrder} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
          <input type="hidden" name="order_id" value={order.id} />
          <label htmlFor="repartidor_id" className="block text-sm font-medium text-gray-700">
            Asignar a repartidor
          </label>
          <div className="flex gap-2">
            <select
              id="repartidor_id"
              name="repartidor_id"
              defaultValue={order.assigned_to ?? ""}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
            >
              <option value="">— Sin asignar —</option>
              {repartidores.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 font-semibold text-white transition hover:bg-brand-dark"
            >
              Guardar
            </button>
          </div>
          {repartidores.length === 0 && (
            <p className="text-xs text-amber-700">
              No hay repartidores activos. Crea usuarios con rol repartidor en Usuarios.
            </p>
          )}
        </form>
      )}

      {/* Completar (repartidor/admin) */}
      {canComplete && order.assigned_to && (
        <CompletarForm orderId={order.id} tipo={order.tipo} />
      )}

      {canComplete && !order.assigned_to && profile.role === "repartidor" && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Esta orden aún no está asignada.
        </p>
      )}

      {/* Guía (cuando ya se completó) */}
      {order.guia_url && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-gray-500">Guía</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={order.guia_url}
            alt="Foto de la guía"
            className="w-full rounded-xl border border-gray-200 bg-white object-contain"
          />
        </div>
      )}

      {/* Eliminar (admin) */}
      {profile.role === "admin" && (
        <form action={deleteOrder}>
          <input type="hidden" name="order_id" value={order.id} />
          <button
            type="submit"
            className="text-sm text-gray-400 underline hover:text-brand"
          >
            Eliminar orden
          </button>
        </form>
      )}
    </div>
  );
}
