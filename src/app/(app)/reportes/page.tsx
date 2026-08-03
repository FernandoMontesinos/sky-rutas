import Link from "next/link";
import { Download, FileArchive, Search } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, TypeBadge } from "@/components/badges";
import {
  LIMITE_FILAS,
  construirConsulta,
  fechaHoraLima,
  filtrosAQuery,
  parseFiltros,
  resumen,
  type ReporteRow,
} from "@/lib/reportes";
import { MODALIDAD_SHORT, type Profile } from "@/lib/types";

const CAMPO_SELECT =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-brand";
const CAMPO_LABEL = "mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(["admin", "almacen"]);
  const filtros = parseFiltros(await searchParams);
  const supabase = await createClient();

  const [{ data: ordenes }, { data: personas }] = await Promise.all([
    construirConsulta(supabase, filtros),
    supabase.from("profiles").select("*").eq("activo", true).order("full_name"),
  ]);

  const rows = (ordenes ?? []) as unknown as ReporteRow[];
  const perfiles = (personas ?? []) as Profile[];
  const vendedores = perfiles.filter((p) => p.role === "vendedor" || p.role === "admin");
  const repartidores = perfiles.filter((p) => p.role === "repartidor");

  const totales = resumen(rows);
  const tarjetas = [
    { label: "Total", value: totales.total, tone: "bg-gray-100 text-gray-800" },
    { label: "Pendientes", value: totales.pendientes, tone: "bg-gray-100 text-gray-700" },
    { label: "Asignadas", value: totales.asignadas, tone: "bg-amber-50 text-amber-800" },
    { label: "En Tránsito", value: totales.enTransito, tone: "bg-sky-50 text-sky-800" },
    { label: "Completadas", value: totales.completadas, tone: "bg-green-50 text-green-800" },
    { label: "Parciales", value: totales.parciales, tone: "bg-orange-50 text-orange-800" },
  ];

  const etiquetaFecha = filtros.eje === "completado" ? "Fecha de completado" : "Fecha de creación";
  const fechaDeFila = (r: ReporteRow) =>
    filtros.eje === "completado" ? r.completed_at : r.created_at;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>

      {/* Filtros: form GET para que el estado viva en la URL (link compartible). */}
      <form method="get" className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label htmlFor="eje" className={CAMPO_LABEL}>
              Filtrar por
            </label>
            <select id="eje" name="eje" defaultValue={filtros.eje} className={CAMPO_SELECT}>
              <option value="creacion">Fecha de creación</option>
              <option value="completado">Fecha de completado</option>
            </select>
          </div>
          <div>
            <label htmlFor="desde" className={CAMPO_LABEL}>
              Desde
            </label>
            <input
              type="date"
              id="desde"
              name="desde"
              defaultValue={filtros.desde}
              className={CAMPO_SELECT}
            />
          </div>
          <div>
            <label htmlFor="hasta" className={CAMPO_LABEL}>
              Hasta
            </label>
            <input
              type="date"
              id="hasta"
              name="hasta"
              defaultValue={filtros.hasta}
              className={CAMPO_SELECT}
            />
          </div>
          <div>
            <label htmlFor="estado" className={CAMPO_LABEL}>
              Estado
            </label>
            <select id="estado" name="estado" defaultValue={filtros.estado} className={CAMPO_SELECT}>
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="asignado">Asignado</option>
              <option value="en_transito">En Tránsito</option>
              <option value="completado">Completado</option>
            </select>
          </div>
          <div>
            <label htmlFor="tipo" className={CAMPO_LABEL}>
              Tipo
            </label>
            <select id="tipo" name="tipo" defaultValue={filtros.tipo} className={CAMPO_SELECT}>
              <option value="">Todos</option>
              <option value="entrega">Entrega (cliente)</option>
              <option value="recojo">Recojo (proveedor)</option>
            </select>
          </div>
          <div>
            <label htmlFor="vendedor" className={CAMPO_LABEL}>
              Creado por
            </label>
            <select
              id="vendedor"
              name="vendedor"
              defaultValue={filtros.vendedor}
              className={CAMPO_SELECT}
            >
              <option value="">Todos</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="repartidor" className={CAMPO_LABEL}>
              Repartidor
            </label>
            <select
              id="repartidor"
              name="repartidor"
              defaultValue={filtros.repartidor}
              className={CAMPO_SELECT}
            >
              <option value="">Todos</option>
              {repartidores.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-2 lg:col-span-3">
            <label htmlFor="q" className={CAMPO_LABEL}>
              Buscar
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                strokeWidth={2.25}
              />
              <input
                id="q"
                name="q"
                defaultValue={filtros.q}
                placeholder="N° pedido, cliente o proyecto"
                className={`${CAMPO_SELECT} pl-8`}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              name="parciales"
              value="1"
              defaultChecked={filtros.soloParciales}
              className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
            />
            Solo entregas parciales
          </label>

          <button
            type="submit"
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
          >
            Aplicar filtros
          </button>
          <Link
            href="/reportes"
            className="text-sm font-semibold text-brand-dark hover:underline"
          >
            Limpiar
          </Link>

          <a
            href={`/api/export-guias?${filtrosAQuery(filtros)}`}
            className="flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 sm:ml-auto"
          >
            <FileArchive className="h-4 w-4" strokeWidth={2.25} />
            Descargar guías (ZIP)
          </a>

          <a
            href={`/api/export?${filtrosAQuery(filtros)}`}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            <Download className="h-4 w-4" strokeWidth={2.25} />
            Exportar a Excel
          </a>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tarjetas.map((c) => (
          <div key={c.label} className={`rounded-2xl p-4 ${c.tone}`}>
            <div className="text-2xl font-black tabular-nums">{c.value}</div>
            <div className="text-xs font-medium opacity-80">{c.label}</div>
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-500">
        {totales.total} orden(es) según {etiquetaFecha.toLowerCase()}, entre {filtros.desde} y{" "}
        {filtros.hasta}.
        {rows.length === LIMITE_FILAS && (
          <span className="font-medium text-orange-700">
            {" "}
            Se muestran las primeras {LIMITE_FILAS}: acota el rango de fechas para ver el resto.
          </span>
        )}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-400">
          No hay órdenes con esos filtros.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">N° pedido</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                    Cliente / Proveedor
                  </th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">Proyecto</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                    {etiquetaFecha}
                  </th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">Creado por</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">Tipo</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">Modalidad</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">Estado</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">Repartidor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="transition hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link
                        href={`/ordenes/${r.id}`}
                        className="font-semibold text-gray-900 hover:text-brand"
                      >
                        #{r.numero_pedido}
                      </Link>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-gray-700">
                      {r.cliente || "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-gray-600">
                      {r.proyecto || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                      {fechaHoraLima(fechaDeFila(r)) || "—"}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-gray-600">
                      {r.creador?.full_name ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <TypeBadge tipo={r.tipo} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {MODALIDAD_SHORT[r.modalidad]}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge estado={r.estado} parcial={r.entrega_parcial} />
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-gray-600">
                      {r.repartidor?.full_name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
