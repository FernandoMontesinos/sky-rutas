import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, TypeBadge } from "@/components/badges";
import type { OrderStatus, OrderWithNames } from "@/lib/types";

const SELECT =
  "*, creador:profiles!orders_created_by_fkey(full_name), repartidor:profiles!orders_assigned_to_fkey(full_name)";

type Tab = { label: string; estado?: OrderStatus };

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { userId, profile } = await requireUser();
  const { estado } = await searchParams;
  const supabase = await createClient();

  const isRepartidor = profile.role === "repartidor";

  const tabs: Tab[] = isRepartidor
    ? [
        { label: "Por hacer", estado: "asignado" },
        { label: "Completadas", estado: "completado" },
      ]
    : [
        { label: "Todas" },
        { label: "Pendientes", estado: "pendiente" },
        { label: "Asignadas", estado: "asignado" },
        { label: "Completadas", estado: "completado" },
      ];

  // Estado activo (por defecto el primero del rol).
  const active: OrderStatus | undefined =
    (estado as OrderStatus | undefined) ??
    (isRepartidor ? "asignado" : undefined);

  let query = supabase
    .from("orders")
    .select(SELECT)
    .order("created_at", { ascending: false });

  if (isRepartidor) query = query.eq("assigned_to", userId);
  if (active) query = query.eq("estado", active);

  const { data, error } = await query;
  const orders = (data ?? []) as unknown as OrderWithNames[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">
        {isRepartidor ? "Mi ruta" : "Órdenes"}
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const isActive = (t.estado ?? undefined) === active;
          const href = t.estado ? `/ordenes?estado=${t.estado}` : "/ordenes";
          return (
            <Link
              key={t.label}
              href={href}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "bg-brand text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">
          Error al cargar: {error.message}
        </p>
      )}

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-400">
          No hay órdenes aquí.
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/ordenes/${o.id}`}
                className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-brand/40 hover:shadow"
              >
                {o.imagen_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.imagen_url}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg border border-gray-100 object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">#{o.numero_pedido}</span>
                    <TypeBadge tipo={o.tipo} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <StatusBadge estado={o.estado} />
                    {o.repartidor && <span>🚚 {o.repartidor.full_name}</span>}
                    {!o.repartidor && o.creador && <span>por {o.creador.full_name}</span>}
                  </div>
                </div>
                <span className="self-center text-gray-300">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
