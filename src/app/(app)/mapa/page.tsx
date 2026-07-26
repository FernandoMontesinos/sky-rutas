import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import MapaRepartidores, { type RepMarker } from "@/components/mapa-repartidores";
import type { OrderType } from "@/lib/types";

// Lima, Perú (centro por defecto si aún no hay ubicaciones)
const DEFAULT_CENTER: [number, number] = [-12.0464, -77.0428];

type LocRow = {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
  perfil: { full_name: string } | null;
};

type OrdRow = { numero_pedido: string; tipo: OrderType; assigned_to: string | null };

export default async function MapaPage() {
  await requireRole(["admin", "almacen"]);
  const supabase = await createClient();

  const [{ data: locs }, { data: ords }] = await Promise.all([
    supabase
      .from("repartidor_locations")
      .select("user_id, lat, lng, updated_at, perfil:profiles(full_name)"),
    supabase
      .from("orders")
      .select("numero_pedido, tipo, assigned_to")
      .eq("estado", "asignado"),
  ]);

  const locations = (locs ?? []) as unknown as LocRow[];
  const orders = (ords ?? []) as unknown as OrdRow[];

  const ordersByRep = new Map<string, { numero: string; tipo: OrderType }[]>();
  for (const o of orders) {
    if (!o.assigned_to) continue;
    const list = ordersByRep.get(o.assigned_to) ?? [];
    list.push({ numero: o.numero_pedido, tipo: o.tipo });
    ordersByRep.set(o.assigned_to, list);
  }

  const markers: RepMarker[] = locations.map((l) => ({
    userId: l.user_id,
    nombre: l.perfil?.full_name ?? "Repartidor",
    lat: l.lat,
    lng: l.lng,
    updatedAt: l.updated_at,
    ordenes: ordersByRep.get(l.user_id) ?? [],
  }));

  const center: [number, number] = markers.length
    ? [markers[0].lat, markers[0].lng]
    : DEFAULT_CENTER;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mapa de repartidores</h1>
        <span className="text-sm text-gray-500">{markers.length} en línea</span>
      </div>

      {markers.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
          Aún no hay ubicaciones. La ubicación se comparte automáticamente cuando un
          repartidor abre la app y acepta el permiso de ubicación en su celular.
        </p>
      )}

      <MapaRepartidores markers={markers} center={center} />

      <p className="text-xs text-gray-400">
        Las ubicaciones se actualizan mientras el repartidor tiene la app abierta y
        compartiendo. Recarga la página para ver las posiciones más recientes.
      </p>
    </div>
  );
}
