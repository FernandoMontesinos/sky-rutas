import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MODALIDAD_SHORT, TYPE_LABEL, type Modalidad, type OrderType } from "@/lib/types";

type Row = {
  cliente: string | null;
  numero_pedido: string;
  tipo: OrderType;
  modalidad: Modalidad;
  completed_at: string | null;
  repartidor: { full_name: string } | null;
};

function limaDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}
function limaHora(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fechaLarga(ymd: string) {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("es-PE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireRole(["admin", "almacen"]);
  const { desde: spDesde, hasta: spHasta } = await searchParams;

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  const hace2 = new Date(Date.now() - 2 * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "America/Lima",
  });
  const desde = spDesde || hace2;
  const hasta = spHasta || hoy;

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "cliente, numero_pedido, tipo, modalidad, completed_at, repartidor:profiles!orders_assigned_to_fkey(full_name)"
    )
    .eq("estado", "completado")
    .gte("completed_at", `${desde}T00:00:00-05:00`)
    .lte("completed_at", `${hasta}T23:59:59-05:00`)
    .order("completed_at", { ascending: false });

  const rows = (data ?? []) as unknown as Row[];

  // Agrupar por día (hora de Lima)
  const porDia = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.completed_at) continue;
    const d = limaDate(r.completed_at);
    const list = porDia.get(d) ?? [];
    list.push(r);
    porDia.set(d, list);
  }
  const dias = [...porDia.keys()].sort((a, b) => b.localeCompare(a));

  const exportHref = `/api/export?desde=${desde}&hasta=${hasta}`;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>

      {/* Filtro */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm"
      >
        <div>
          <label htmlFor="desde" className="mb-1 block text-sm font-medium text-gray-700">
            Desde
          </label>
          <input
            type="date"
            id="desde"
            name="desde"
            defaultValue={desde}
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>
        <div>
          <label htmlFor="hasta" className="mb-1 block text-sm font-medium text-gray-700">
            Hasta
          </label>
          <input
            type="date"
            id="hasta"
            name="hasta"
            defaultValue={hasta}
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-gray-800 px-4 py-2 font-semibold text-white hover:bg-gray-700"
        >
          Filtrar
        </button>
        <a
          href={exportHref}
          className="ml-auto rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
        >
          ⬇ Exportar a Excel
        </a>
      </form>

      <p className="text-sm text-gray-500">
        {rows.length} orden(es) completada(s) entre {desde} y {hasta}.
      </p>

      {dias.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-400">
          No hay órdenes completadas en ese rango.
        </p>
      ) : (
        dias.map((dia) => (
          <div key={dia} className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
              <span className="font-semibold capitalize text-gray-800">{fechaLarga(dia)}</span>
              <span className="text-xs text-gray-500">{porDia.get(dia)!.length} órdenes</span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Cliente / Proveedor</th>
                  <th className="px-4 py-2 font-medium">N° orden</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Modalidad</th>
                  <th className="px-4 py-2 font-medium">Repartidor</th>
                  <th className="px-4 py-2 font-medium">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {porDia.get(dia)!.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-medium text-gray-800">{r.cliente || "—"}</td>
                    <td className="px-4 py-2 text-gray-700">#{r.numero_pedido}</td>
                    <td className="px-4 py-2 text-gray-600">{TYPE_LABEL[r.tipo]}</td>
                    <td className="px-4 py-2 text-gray-600">{MODALIDAD_SHORT[r.modalidad]}</td>
                    <td className="px-4 py-2 text-gray-600">{r.repartidor?.full_name ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{limaHora(r.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
