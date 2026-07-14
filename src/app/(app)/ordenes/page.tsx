import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ModalidadBadge, TypeBadge } from "@/components/badges";
import type { OrderStatus, OrderWithNames } from "@/lib/types";

const SELECT =
  "*, creador:profiles!orders_created_by_fkey(full_name), repartidor:profiles!orders_assigned_to_fkey(full_name)";

/** ISO de hace N días (fuera del componente para cumplir la regla de pureza de React). */
function isoHaceDias(dias: number) {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

function OrderCard({ o }: { o: OrderWithNames }) {
  const imagenes = o.imagenes_urls?.length ? o.imagenes_urls : o.imagen_url ? [o.imagen_url] : [];

  return (
    <Link
      href={`/ordenes/${o.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-brand/40 hover:shadow"
    >
      <div className="flex gap-3">
        {imagenes[0] && (
          <div className="relative h-12 w-12 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagenes[0]}
              alt=""
              className="h-12 w-12 rounded-lg border border-gray-100 object-cover"
            />
            {imagenes.length > 1 && (
              <span className="absolute -bottom-1 -right-1 rounded-full bg-gray-800 px-1 text-[10px] font-bold text-white">
                +{imagenes.length - 1}
              </span>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-bold text-gray-900">#{o.numero_pedido}</span>
            <TypeBadge tipo={o.tipo} />
            <ModalidadBadge modalidad={o.modalidad} />
            {o.entrega_parcial && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
                Parcial
              </span>
            )}
            {o.nota && <span title="Tiene nota">📝</span>}
          </div>
          {o.cliente && (
            <div className="mt-0.5 truncate text-xs font-medium text-gray-700">{o.cliente}</div>
          )}
          <div className="truncate text-xs text-gray-500">
            {o.repartidor ? `🚚 ${o.repartidor.full_name}` : o.creador ? `por ${o.creador.full_name}` : ""}
          </div>
        </div>
      </div>
    </Link>
  );
}

function Column({
  title,
  color,
  orders,
  fullWidthMobile = false,
}: {
  title: string;
  color: string;
  orders: OrderWithNames[];
  /** En móvil ocupa todo el ancho (columnas apiladas) en vez de scroll lateral. */
  fullWidthMobile?: boolean;
}) {
  return (
    <div
      className={`flex shrink-0 flex-col rounded-2xl bg-gray-100 p-2 sm:w-auto sm:flex-1 ${
        fullWidthMobile ? "w-full" : "w-72 snap-start"
      }`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="flex items-center gap-2 font-semibold text-gray-700">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
          {title}
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-500">
          {orders.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {orders.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-gray-400">—</p>
        ) : (
          orders.map((o) => <OrderCard key={o.id} o={o} />)
        )}
      </div>
    </div>
  );
}

export default async function OrdenesPage() {
  const { userId, profile } = await requireUser();
  const supabase = await createClient();
  const isRepartidor = profile.role === "repartidor";

  // Activas (pendiente + asignado) y completadas (recientes).
  let activas = supabase
    .from("orders")
    .select(SELECT)
    .in("estado", ["pendiente", "asignado"])
    .order("created_at", { ascending: false });

  // Solo completadas de los últimos 2 días para no sobrecargar el tablero.
  const desde2dias = isoHaceDias(2);
  let completadas = supabase
    .from("orders")
    .select(SELECT)
    .eq("estado", "completado")
    .gte("completed_at", desde2dias)
    .order("completed_at", { ascending: false })
    .limit(100);

  if (isRepartidor) {
    activas = activas.eq("assigned_to", userId);
    completadas = completadas.eq("assigned_to", userId);
  }

  const [{ data: act }, { data: comp }] = await Promise.all([activas, completadas]);
  const activasList = (act ?? []) as unknown as OrderWithNames[];
  const completadasList = (comp ?? []) as unknown as OrderWithNames[];

  const byEstado = (e: OrderStatus) => activasList.filter((o) => o.estado === e);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isRepartidor ? "Mi ruta" : "Tablero de órdenes"}
        </h1>
        {(profile.role === "admin" || profile.role === "vendedor") && (
          <Link
            href="/ordenes/nueva"
            className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            ➕ Nueva
          </Link>
        )}
      </div>

      {isRepartidor ? (
        /* Repartidor: columnas apiladas en móvil — su ruta primero, sin scroll lateral */
        <div className="flex flex-col gap-3 sm:flex-row">
          <Column
            title="Por hacer"
            color="bg-amber-500"
            orders={byEstado("asignado")}
            fullWidthMobile
          />
          <Column
            title="Completadas · 2 días"
            color="bg-green-500"
            orders={completadasList}
            fullWidthMobile
          />
        </div>
      ) : (
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:snap-none sm:overflow-visible">
          <Column title="Pendientes" color="bg-gray-400" orders={byEstado("pendiente")} />
          <Column title="Asignadas" color="bg-amber-500" orders={byEstado("asignado")} />
          <Column title="Completadas · 2 días" color="bg-green-500" orders={completadasList} />
        </div>
      )}
    </div>
  );
}
