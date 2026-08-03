import type { createClient } from "@/lib/supabase/server";
import type { DivisionTipo, Modalidad, OrderStatus, OrderType } from "@/lib/types";

/**
 * Filtros del módulo de Reportes, compartidos entre la página y el export
 * a Excel (`/api/export`). Viven aquí para que el archivo descargado
 * contenga exactamente lo mismo que se ve en pantalla — si cada lado
 * armara su propia consulta, tarde o temprano se desincronizan.
 */

/** Arequipa/Lima no usa horario de verano, así que el offset es fijo. */
const OFFSET_LIMA = "-05:00";
const TZ_LIMA = "America/Lima";

export type EjeFecha = "creacion" | "completado";

export type ReporteFiltros = {
  /** Sobre qué fecha se aplica el rango: cuándo se creó o cuándo se completó. */
  eje: EjeFecha;
  desde: string;
  hasta: string;
  /** "" = todos */
  estado: OrderStatus | "";
  tipo: OrderType | "";
  vendedor: string;
  repartidor: string;
  /** Solo las que quedaron como entrega parcial. */
  soloParciales: boolean;
  q: string;
};

export type ReporteRow = {
  id: string;
  numero_pedido: string;
  cliente: string | null;
  proyecto: string | null;
  proveedor: string | null;
  numero_pedido_compra: string | null;
  tipo: OrderType;
  estado: OrderStatus;
  modalidad: Modalidad;
  courier_tracking: string | null;
  entrega_parcial: boolean;
  no_recogido_intentos: number;
  no_recogido_motivo: string | null;
  parent_order_id: string | null;
  division_tipo: DivisionTipo | null;
  nota: string | null;
  created_at: string;
  assigned_at: string | null;
  en_transito_at: string | null;
  completed_at: string | null;
  imagen_url: string | null;
  imagenes_urls: string[] | null;
  creador: { full_name: string } | null;
  repartidor: { full_name: string } | null;
};

export const SELECT_REPORTE =
  "id, numero_pedido, cliente, proyecto, proveedor, numero_pedido_compra, tipo, estado, modalidad, " +
  "courier_tracking, entrega_parcial, no_recogido_intentos, no_recogido_motivo, " +
  "parent_order_id, division_tipo, nota, created_at, assigned_at, en_transito_at, completed_at, " +
  "imagen_url, imagenes_urls, " +
  "creador:profiles!orders_created_by_fkey(full_name), repartidor:profiles!orders_assigned_to_fkey(full_name)";

/** Tope de filas por consulta: el rango de fechas ya acota, esto es solo red de seguridad. */
export const LIMITE_FILAS = 5000;

const ESTADOS: OrderStatus[] = ["pendiente", "asignado", "en_transito", "completado"];
const TIPOS: OrderType[] = ["entrega", "recojo"];

/** Fecha en formato YYYY-MM-DD según el reloj de Lima. */
export function ymdLima(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: TZ_LIMA });
}

/** Rango por defecto: los últimos `dias` días (hoy incluido) en hora de Lima. */
export function rangoPorDefecto(dias = 7) {
  return {
    desde: ymdLima(new Date(Date.now() - (dias - 1) * 86_400_000)),
    hasta: ymdLima(new Date()),
  };
}

/** Columna de `orders` sobre la que se filtra el rango de fechas. */
export function campoFecha(eje: EjeFecha) {
  return eje === "completado" ? "completed_at" : "created_at";
}

/**
 * Limpia el texto de búsqueda: la sintaxis de `.or()` de PostgREST usa
 * comas y paréntesis como separadores, así que un cliente con coma en el
 * nombre rompería la consulta si se pasara tal cual.
 */
export function limpiarBusqueda(q: string) {
  return q.replace(/[,()*%\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

function esFechaValida(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function parseFiltros(sp: Record<string, string | undefined>): ReporteFiltros {
  const def = rangoPorDefecto();
  const estado = ESTADOS.includes(sp.estado as OrderStatus) ? (sp.estado as OrderStatus) : "";
  const tipo = TIPOS.includes(sp.tipo as OrderType) ? (sp.tipo as OrderType) : "";

  let desde = esFechaValida(sp.desde) ? sp.desde : def.desde;
  let hasta = esFechaValida(sp.hasta) ? sp.hasta : def.hasta;
  // Si el usuario invierte el rango, lo ordenamos en vez de devolver vacío.
  if (desde > hasta) [desde, hasta] = [hasta, desde];

  return {
    eje: sp.eje === "completado" ? "completado" : "creacion",
    desde,
    hasta,
    estado,
    tipo,
    vendedor: sp.vendedor?.trim() || "",
    repartidor: sp.repartidor?.trim() || "",
    soloParciales: sp.parciales === "1",
    q: limpiarBusqueda(sp.q ?? ""),
  };
}

/** Los mismos filtros como querystring, para el enlace de "Exportar a Excel". */
export function filtrosAQuery(f: ReporteFiltros) {
  const p = new URLSearchParams({ eje: f.eje, desde: f.desde, hasta: f.hasta });
  if (f.estado) p.set("estado", f.estado);
  if (f.tipo) p.set("tipo", f.tipo);
  if (f.vendedor) p.set("vendedor", f.vendedor);
  if (f.repartidor) p.set("repartidor", f.repartidor);
  if (f.soloParciales) p.set("parciales", "1");
  if (f.q) p.set("q", f.q);
  return p.toString();
}

/**
 * Consulta de órdenes ya filtrada y ordenada (más reciente primero).
 * `select` es sobreescribible para reusar los mismos filtros con otras
 * columnas (ej. /api/export-guias necesita guia_url/numero_guia, no las
 * columnas del Excel) sin duplicar la lógica de filtros en dos lugares.
 */
export function construirConsulta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  f: ReporteFiltros,
  select: string = SELECT_REPORTE
) {
  const campo = campoFecha(f.eje);

  let query = supabase
    .from("orders")
    .select(select)
    .gte(campo, `${f.desde}T00:00:00${OFFSET_LIMA}`)
    .lte(campo, `${f.hasta}T23:59:59${OFFSET_LIMA}`);

  if (f.estado) query = query.eq("estado", f.estado);
  if (f.tipo) query = query.eq("tipo", f.tipo);
  if (f.vendedor) query = query.eq("created_by", f.vendedor);
  if (f.repartidor) query = query.eq("assigned_to", f.repartidor);
  if (f.soloParciales) query = query.eq("entrega_parcial", true);
  if (f.q) {
    query = query.or(
      `numero_pedido.ilike.%${f.q}%,cliente.ilike.%${f.q}%,proyecto.ilike.%${f.q}%,proveedor.ilike.%${f.q}%`
    );
  }

  return query.order(campo, { ascending: false, nullsFirst: false }).limit(LIMITE_FILAS);
}

/** Conteos para las tarjetas de resumen, calculados sobre las filas ya filtradas. */
export function resumen(rows: ReporteRow[]) {
  return {
    total: rows.length,
    pendientes: rows.filter((r) => r.estado === "pendiente").length,
    asignadas: rows.filter((r) => r.estado === "asignado").length,
    enTransito: rows.filter((r) => r.estado === "en_transito").length,
    completadas: rows.filter((r) => r.estado === "completado").length,
    parciales: rows.filter((r) => r.entrega_parcial).length,
  };
}

/** Fecha y hora en el reloj de Lima, para mostrar y para el Excel. */
export function fechaHoraLima(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: TZ_LIMA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
