import Link from "next/link";
import {
  Plus,
  StickyNote,
  Truck,
  Users,
  LayoutGrid,
  Table2,
  Rows3,
  AlignLeft,
  FileText,
  ChevronDown,
  Search,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ModalidadBadge, StatusBadge, TypeBadge } from "@/components/badges";
import { limpiarBusqueda, ymdLima } from "@/lib/reportes";
import {
  MODALIDAD_SHORT,
  modalidadLabel,
  type Modalidad,
  type OrderStatus,
  type OrderType,
  type OrderWithNames,
  type Profile,
} from "@/lib/types";

const MODALIDADES: Modalidad[] = ["reparto", "oficina", "courier"];

/** Inicial para el avatar del repartidor en la vista compacta. */
function inicial(nombre: string | undefined) {
  return nombre?.trim()?.[0]?.toUpperCase() ?? "?";
}

const SELECT =
  "*, creador:profiles!orders_created_by_fkey(full_name), repartidor:profiles!orders_assigned_to_fkey(full_name)";

/** ISO de hace N días (fuera del componente para cumplir la regla de pureza de React). */
function isoHaceDias(dias: number) {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

type RangoCompletadas = "hoy" | "semana" | "mes";

/** Etapa del día del repartidor: una pestaña por cada una (ver el layout). */
type PanelRepartidor = "por-hacer" | "recogidas" | "completadas";

const RANGO_LABEL: Record<RangoCompletadas, string> = {
  hoy: "Hoy",
  semana: "Últimos 7 días",
  mes: "Últimos 30 días",
};

/** Desde cuándo mirar las completadas, según el rango elegido. */
function desdeParaRango(rango: RangoCompletadas) {
  if (rango === "hoy") return `${ymdLima(new Date())}T00:00:00-05:00`;
  return isoHaceDias(rango === "semana" ? 7 : 30);
}

function fmtFechaHora(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const fecha = d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const hora = d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  return `${fecha} · ${hora}`;
}

function esPdfUrl(url: string) {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}

const TZ_LIMA = "America/Lima";
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ_LIMA });

/**
 * Hora corta para las tarjetas: "10:32" si es de hoy, "ayer 15:40", y
 * "02/08 09:15" si es más vieja. El repartidor se guía mucho por la hora y
 * antes tenía que abrir la orden para verla; en la tarjeta tiene que caber
 * al lado de todo lo demás, así que se muestra lo mínimo que la ubica.
 */
function horaCorta(iso: string | null, hoyStr: string, ayerStr: string) {
  if (!iso) return null;
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("es-PE", {
    timeZone: TZ_LIMA,
    hour: "2-digit",
    minute: "2-digit",
  });
  const dia = ymd(d);
  if (dia === hoyStr) return hora;
  if (dia === ayerStr) return `ayer ${hora}`;
  // Se arma a mano en vez de pedirle a Intl día/mes sin año: sin el año en
  // las opciones, el motor de fechas de este runtime devuelve "3/8" en vez
  // de "03/08" — se pierde el cero y ya no se lee como fecha a simple vista.
  const [, mes, diaNum] = dia.split("-");
  return `${diaNum}/${mes} ${hora}`;
}

/**
 * Vista compacta: lo mínimo para que almacén decida sin abrir la orden
 * (N° pedido, cliente, tipo como ícono, repartidor como avatar, y el
 * aviso de "Parcial" que nunca se oculta porque es información operativa).
 * Sin miniatura, sin modalidad completa, sin "por creador" — eso vive
 * solo en la vista detallada.
 */
function OrderCardCompact({ o, sello }: { o: OrderWithNames; sello: string | null }) {
  const tipoStyle =
    o.tipo === "entrega" ? "bg-brand/10 text-brand" : "bg-gray-800 text-white";

  return (
    <Link
      href={`/ordenes/${o.id}`}
      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-2 shadow-sm transition hover:border-brand/40 hover:shadow"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${tipoStyle}`}
        title={o.tipo === "entrega" ? "Cotización (cliente)" : "Pedido de compra (proveedor)"}
      >
        {o.tipo === "entrega" ? "S" : "P"}
      </span>

      {/* Empresa primero: almacén busca por nombre de cliente/proveedor, no
          por número. El número queda debajo como dato de referencia. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold text-gray-900">
            {o.cliente || `#${o.numero_pedido}`}
          </span>
          {o.entrega_parcial && (
            <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold text-orange-800">
              Parcial
            </span>
          )}
          {o.no_recogido_intentos > 0 && (
            <span
              className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700"
              title={o.no_recogido_motivo ?? undefined}
            >
              No recogido{o.no_recogido_intentos > 1 && ` ×${o.no_recogido_intentos}`}
            </span>
          )}
          {o.nota && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400"
              title="Tiene nota"
              aria-label="Tiene nota"
            />
          )}
        </div>
        {(o.cliente || sello) && (
          <div className="truncate text-xs text-gray-500">
            {o.cliente && `#${o.numero_pedido}`}
            {o.cliente && sello && " · "}
            {sello && <span className="font-medium text-gray-600">{sello}</span>}
          </div>
        )}
      </div>

      {o.repartidor && (
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand"
          title={o.repartidor.full_name}
        >
          {inicial(o.repartidor.full_name)}
        </span>
      )}
    </Link>
  );
}

function OrderCardDetallado({ o, sello }: { o: OrderWithNames; sello: string | null }) {
  const imagenes = o.imagenes_urls?.length ? o.imagenes_urls : o.imagen_url ? [o.imagen_url] : [];

  return (
    <Link
      href={`/ordenes/${o.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-brand/40 hover:shadow"
    >
      <div className="flex gap-3">
        {imagenes[0] && (
          <div className="relative h-12 w-12 shrink-0">
            {esPdfUrl(imagenes[0]) ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-100 bg-gray-50">
                <FileText className="h-5 w-5 text-gray-400" strokeWidth={1.75} />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagenes[0]}
                alt=""
                className="h-12 w-12 rounded-lg border border-gray-100 object-cover"
              />
            )}
            {imagenes.length > 1 && (
              <span className="absolute -bottom-1 -right-1 rounded-full bg-gray-800 px-1 text-[10px] font-bold text-white">
                +{imagenes.length - 1}
              </span>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {/* Igual que en la compacta: manda el nombre de la empresa. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-bold text-gray-900">
              {o.cliente || `#${o.numero_pedido}`}
            </span>
            <TypeBadge tipo={o.tipo} />
            <ModalidadBadge modalidad={o.modalidad} />
            {o.entrega_parcial && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
                Parcial
              </span>
            )}
            {o.no_recogido_intentos > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                No recogido{o.no_recogido_intentos > 1 && ` ×${o.no_recogido_intentos}`}
              </span>
            )}
            {o.nota && (
              <StickyNote className="h-3.5 w-3.5 text-gray-400" strokeWidth={2.25} aria-label="Tiene nota" />
            )}
          </div>
          {(o.cliente || sello) && (
            <div className="mt-0.5 truncate text-xs font-medium text-gray-500">
              {o.cliente && `#${o.numero_pedido}`}
              {o.cliente && sello && " · "}
              {sello && <span className="text-gray-600">{sello}</span>}
            </div>
          )}
          {o.proyecto && (
            <div className="truncate text-xs text-gray-500">Proyecto: {o.proyecto}</div>
          )}
          {o.no_recogido_motivo && (
            <div className="truncate text-xs text-red-600" title={o.no_recogido_motivo}>
              {o.no_recogido_motivo}
            </div>
          )}
          <div className="flex items-center gap-1 truncate text-xs text-gray-500">
            {o.repartidor ? (
              <>
                <Truck className="h-3 w-3 shrink-0" strokeWidth={2.25} />
                <span className="truncate">{o.repartidor.full_name}</span>
              </>
            ) : o.creador ? (
              <span className="truncate">por {o.creador.full_name}</span>
            ) : null}
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
  detallado,
  hoyStr,
  ayerStr,
  usarCompletado = false,
  fullWidthMobile = false,
  separarNoRecogidos = false,
}: {
  title: string;
  color: string;
  orders: OrderWithNames[];
  detallado: boolean;
  hoyStr: string;
  ayerStr: string;
  /** En Completadas interesa cuándo se cerró, no cuándo se creó. */
  usarCompletado?: boolean;
  /** En móvil ocupa todo el ancho (columnas apiladas) en vez de scroll lateral. */
  fullWidthMobile?: boolean;
  /** Solo en Pendientes: sube arriba las que volvieron por un recojo fallido. */
  separarNoRecogidos?: boolean;
}) {
  const sello = (o: OrderWithNames) =>
    horaCorta(usarCompletado ? o.completed_at : o.created_at, hoyStr, ayerStr);
  // Ya no hace falta separar cotizaciones de pedidos dentro de la columna:
  // ahora son dos tableros distintos, cada uno con su propio tipo.
  const Card = detallado ? OrderCardDetallado : OrderCardCompact;

  // Agrupadas por empresa (alfabético) en vez de por fecha: todas las
  // órdenes de un mismo cliente/proveedor quedan juntas, que es como
  // almacén/ventas las busca de un vistazo. Un `.sort` sobre solo el nombre
  // es estable (garantizado desde ES2019), así que dentro de una misma
  // empresa las órdenes conservan el orden por fecha que ya traía la
  // consulta — no hace falta un criterio de desempate aparte. Sin empresa
  // (caso raro) va al final, no al principio.
  const porEmpresa = (a: OrderWithNames, b: OrderWithNames) => {
    const na = (a.cliente ?? "").trim();
    const nb = (b.cliente ?? "").trim();
    if (!na && nb) return 1;
    if (na && !nb) return -1;
    return na.localeCompare(nb, "es", { sensitivity: "base" });
  };
  const ordenadas = [...orders].sort(porEmpresa);

  // Una orden que volvió por "no se recogió" necesita una acción distinta a
  // una orden nueva (llamar al proveedor vs. asignar repartidor), así que va
  // agrupada arriba en vez de perdida entre las demás.
  const noRecogidas = separarNoRecogidos ? ordenadas.filter((o) => o.no_recogido_intentos > 0) : [];
  const resto = separarNoRecogidos ? ordenadas.filter((o) => o.no_recogido_intentos === 0) : ordenadas;

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
          <>
            {noRecogidas.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-red-500">
                  <span className="h-px flex-1 bg-red-200" />
                  No se pudo recoger
                  <span className="h-px flex-1 bg-red-200" />
                </div>
                {noRecogidas.map((o) => (
                  <Card key={o.id} o={o} sello={sello(o)} />
                ))}
                {resto.length > 0 && <div className="my-1 h-px bg-gray-300" />}
              </>
            )}
            {resto.map((o) => (
              <Card key={o.id} o={o} sello={sello(o)} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** Vista tipo Notion: todas las órdenes en una sola tabla, sin dividir en columnas. */
function TablaOrdenes({ orders }: { orders: OrderWithNames[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
        Sin órdenes en este rango.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">N° pedido</th>
              <th className="px-3 py-2 font-medium">Cliente / Proveedor</th>
              <th className="px-3 py-2 font-medium">Fecha de creación</th>
              <th className="px-3 py-2 font-medium">Creado por</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Modalidad</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Repartidor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o) => (
              <tr key={o.id} className="transition hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2">
                  <Link href={`/ordenes/${o.id}`} className="font-semibold text-gray-900 hover:text-brand">
                    #{o.numero_pedido}
                  </Link>
                </td>
                <td className="max-w-[180px] truncate px-3 py-2 text-gray-700">{o.cliente || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">{fmtFechaHora(o.created_at)}</td>
                <td className="max-w-[140px] truncate px-3 py-2 text-gray-600">
                  {o.creador?.full_name ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <TypeBadge tipo={o.tipo} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{MODALIDAD_SHORT[o.modalidad]}</td>
                <td className="px-3 py-2">
                  <StatusBadge estado={o.estado} parcial={o.entrega_parcial} />
                </td>
                <td className="max-w-[140px] truncate px-3 py-2 text-gray-600">
                  {o.repartidor?.full_name ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<{
    vista?: string;
    panel?: string;
    formato?: string;
    densidad?: string;
    rango?: string;
    q?: string;
    repartidor?: string;
    vendedor?: string;
    modalidad?: string;
    problema?: string;
  }>;
}) {
  const { userId, profile } = await requireUser();
  const sp = await searchParams;
  const supabase = await createClient();
  const isRepartidor = profile.role === "repartidor";
  const verTodas = isRepartidor && sp.vista === "todas";
  // Etapa que mira el repartidor en "Mi ruta". Cada una es una pestaña de la
  // barra inferior (ver NAV_REPARTIDOR en el layout): en la calle necesita
  // saber qué le queda por hacer sin scrollear tres columnas apiladas.
  const panel: PanelRepartidor =
    sp.panel === "recogidas" || sp.panel === "completadas" ? sp.panel : "por-hacer";
  const rutaPropia = isRepartidor && !verTodas;
  const formato = !rutaPropia && sp.formato === "tabla" ? "tabla" : "kanban";
  // Compacto por defecto para todos los roles, repartidor incluido: es la
  // vista pensada para decidir de un vistazo y entran más órdenes en una
  // pantalla de celular. Detallada (con miniatura, modalidad y creador)
  // queda a un toque para cuando hace falta más contexto.
  const detallado = sp.densidad === "detallada";
  const rango: RangoCompletadas =
    sp.rango === "semana" || sp.rango === "mes" ? sp.rango : "hoy";

  // Se resuelve una sola vez por carga y se baja a las tarjetas, en vez de
  // que cada una vuelva a leer el reloj.
  const ahora = new Date();
  const hoyStr = ymd(ahora);
  const ayerStr = ymd(new Date(ahora.getTime() - 86_400_000));
  const fechas = { hoyStr, ayerStr };

  const q = limpiarBusqueda(sp.q ?? "");
  const fRepartidor = sp.repartidor?.trim() || "";
  const fVendedor = sp.vendedor?.trim() || "";
  const fModalidad = MODALIDADES.includes(sp.modalidad as Modalidad)
    ? (sp.modalidad as Modalidad)
    : "";
  const soloProblema = sp.problema === "1";
  const hayFiltro = !!(q || fRepartidor || fVendedor || fModalidad || soloProblema);

  /**
   * Enlace a esta misma pantalla cambiando solo lo que se le pase. Antes cada
   * control rearmaba la lista completa de parámetros y había que tocar los
   * tres al agregar uno nuevo.
   */
  function href(cambios: Record<string, string | undefined> = {}) {
    const actual: Record<string, string | undefined> = {
      vista: verTodas ? "todas" : undefined,
      panel: panel !== "por-hacer" ? panel : undefined,
      formato: formato === "tabla" ? "tabla" : undefined,
      densidad: detallado ? "detallada" : undefined,
      rango: rango !== "hoy" ? rango : undefined,
      q: q || undefined,
      repartidor: fRepartidor || undefined,
      vendedor: fVendedor || undefined,
      modalidad: fModalidad || undefined,
      problema: soloProblema ? "1" : undefined,
    };
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries({ ...actual, ...cambios })) {
      if (valor) params.set(clave, valor);
    }
    const qs = params.toString();
    return qs ? `/ordenes?${qs}` : "/ordenes";
  }

  // Las personas para los selectores de filtro, y —si se está buscando por
  // texto— los ids de quienes coinciden por nombre: no se puede filtrar por
  // una columna de tabla unida dentro de un .or(), así que el nombre del
  // vendedor se resuelve a ids antes de armar la consulta de órdenes.
  const [{ data: personasData }, { data: creadoresData }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role").eq("activo", true).order("full_name"),
    q
      ? supabase.from("profiles").select("id").ilike("full_name", `%${q}%`)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const personas = (personasData ?? []) as Profile[];
  const repartidores = personas.filter((p) => p.role === "repartidor");
  const vendedores = personas.filter((p) => p.role === "vendedor" || p.role === "admin");
  const idsCreador = (creadoresData ?? []).map((p) => p.id);

  // Activas (pendiente + asignado + en tránsito) y completadas (según el rango elegido).
  let activas = supabase
    .from("orders")
    .select(SELECT)
    .in("estado", ["pendiente", "asignado", "en_transito"])
    .order("created_at", { ascending: false });

  let completadas = supabase
    .from("orders")
    .select(SELECT)
    .eq("estado", "completado")
    .gte("completed_at", desdeParaRango(rango))
    .order("completed_at", { ascending: false })
    .limit(100);

  if (isRepartidor && !verTodas) {
    activas = activas.eq("assigned_to", userId);
    completadas = completadas.eq("assigned_to", userId);
  }

  if (q) {
    const condiciones = [`numero_pedido.ilike.%${q}%`, `cliente.ilike.%${q}%`];
    // Solo si hay coincidencias: `created_by.in.()` vacío es sintaxis inválida.
    if (idsCreador.length > 0) condiciones.push(`created_by.in.(${idsCreador.join(",")})`);
    const filtroO = condiciones.join(",");
    activas = activas.or(filtroO);
    completadas = completadas.or(filtroO);
  }
  if (fRepartidor) {
    activas = activas.eq("assigned_to", fRepartidor);
    completadas = completadas.eq("assigned_to", fRepartidor);
  }
  if (fVendedor) {
    activas = activas.eq("created_by", fVendedor);
    completadas = completadas.eq("created_by", fVendedor);
  }
  if (fModalidad) {
    activas = activas.eq("modalidad", fModalidad);
    completadas = completadas.eq("modalidad", fModalidad);
  }
  if (soloProblema) {
    // Todo lo que necesita atención: entregas parciales y recojos fallidos.
    // (Los envíos divididos se suman acá en la fase siguiente.)
    const filtroProblema = "entrega_parcial.eq.true,no_recogido_intentos.gt.0";
    activas = activas.or(filtroProblema);
    completadas = completadas.or(filtroProblema);
  }

  const [{ data: act }, { data: comp }] = await Promise.all([activas, completadas]);
  const activasList = (act ?? []) as unknown as OrderWithNames[];
  const completadasList = (comp ?? []) as unknown as OrderWithNames[];

  const byEstado = (e: OrderStatus) => activasList.filter((o) => o.estado === e);
  const mostrarTodasLasColumnas = !isRepartidor || verTodas;

  // Dos tableros separados: los Pedidos (Proveedor) tienen 4 etapas porque
  // pasan por "En Tránsito", las Cotizaciones (Cliente) solo 3. Mezclarlos
  // obligaba a mirar columnas que no aplicaban a la mitad de las órdenes.
  // Pedidos va arriba porque hay más recojos que entregas (pedido de almacén).
  const activasDe = (tipo: OrderType, e: OrderStatus) =>
    activasList.filter((o) => o.tipo === tipo && o.estado === e);
  const completadasDe = (tipo: OrderType) => completadasList.filter((o) => o.tipo === tipo);

  // En celular estos controles ocupaban 3 filas antes de llegar a ver una
  // sola orden — se agrupan en un <details> colapsable (sin JS) solo en
  // esa pantalla; de sm en adelante se ven siempre, como antes.
  const controles = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {isRepartidor && (
            <div className="inline-flex rounded-xl bg-gray-100 p-1">
              <Link
                href={href({ vista: undefined })}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  !verTodas ? "bg-white text-brand shadow-sm" : "text-gray-500"
                }`}
              >
                <Truck className="h-4 w-4" strokeWidth={2.25} />
                Mi ruta
              </Link>
              <Link
                href={href({ vista: "todas" })}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  verTodas ? "bg-white text-brand shadow-sm" : "text-gray-500"
                }`}
              >
                <Users className="h-4 w-4" strokeWidth={2.25} />
                Toda la ruta
              </Link>
            </div>
          )}

          {/* Kanban/Tabla es un control de gestión: en "Mi ruta" no aplica
              porque el repartidor ya tiene sus tres pestañas. */}
          {!rutaPropia && (
            <div className="inline-flex rounded-xl bg-gray-100 p-1">
              <Link
                href={href({ formato: undefined })}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  formato === "kanban" ? "bg-white text-brand shadow-sm" : "text-gray-500"
                }`}
              >
                <LayoutGrid className="h-4 w-4" strokeWidth={2.25} />
                Kanban
              </Link>
              <Link
                href={href({ formato: "tabla" })}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  formato === "tabla" ? "bg-white text-brand shadow-sm" : "text-gray-500"
                }`}
              >
                <Table2 className="h-4 w-4" strokeWidth={2.25} />
                Tabla
              </Link>
            </div>
          )}
        </div>

        {formato === "kanban" && (
          <div className="inline-flex rounded-xl bg-gray-100 p-1">
            <Link
              href={href({ densidad: undefined })}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                !detallado ? "bg-white text-brand shadow-sm" : "text-gray-500"
              }`}
            >
              <Rows3 className="h-4 w-4" strokeWidth={2.25} />
              Compacta
            </Link>
            <Link
              href={href({ densidad: "detallada" })}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                detallado ? "bg-white text-brand shadow-sm" : "text-gray-500"
              }`}
            >
              <AlignLeft className="h-4 w-4" strokeWidth={2.25} />
              Detallada
            </Link>
          </div>
        )}
      </div>

      {/* El rango solo aplica a las completadas: en "Mi ruta" se muestra
          únicamente cuando el repartidor está parado en esa pestaña. */}
      {(!rutaPropia || panel === "completadas") && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Completadas:</span>
          <div className="inline-flex rounded-xl bg-gray-100 p-1">
            {(["hoy", "semana", "mes"] as RangoCompletadas[]).map((r) => (
              <Link
                key={r}
                href={href({ rango: r === "hoy" ? undefined : r })}
                className={`rounded-lg px-3 py-1 font-semibold transition ${
                  rango === r ? "bg-white text-brand shadow-sm" : "text-gray-500"
                }`}
              >
                {RANGO_LABEL[r]}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/*
        Buscador y filtros como form GET: el estado vive en la URL (enlace
        compartible) y funciona sin JavaScript. Los toggles de arriba son
        enlaces, así que hay que llevarlos como campos ocultos para no
        perderlos al buscar.
      */}
      <form method="get" className="flex flex-wrap items-end gap-2">
        {verTodas && <input type="hidden" name="vista" value="todas" />}
        {panel !== "por-hacer" && <input type="hidden" name="panel" value={panel} />}
        {formato === "tabla" && <input type="hidden" name="formato" value="tabla" />}
        {detallado && <input type="hidden" name="densidad" value="detallada" />}
        {rango !== "hoy" && <input type="hidden" name="rango" value={rango} />}

        {/* Sin id: este bloque se renderiza dos veces (móvil y escritorio) y
            un id repetido sería HTML inválido. */}
        <div className="min-w-[200px] flex-1">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              strokeWidth={2.25}
            />
            <input
              name="q"
              aria-label="Buscar órdenes"
              defaultValue={q}
              placeholder={
                rutaPropia
                  ? "Buscar por N° o cliente"
                  : "N° de orden, cliente/proveedor o quién la creó"
              }
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        {!isRepartidor && (
          <>
            <select
              name="repartidor"
              defaultValue={fRepartidor}
              aria-label="Filtrar por repartidor"
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="">Repartidor: todos</option>
              {repartidores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>

            <select
              name="vendedor"
              defaultValue={fVendedor}
              aria-label="Filtrar por quién la creó"
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="">Creado por: todos</option>
              {vendedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </>
        )}

        {/* Modalidad y "con problema" son filtros de gestión. Al repartidor
            le llegan sus órdenes ya asignadas: lo único que necesita en la
            calle es encontrar una por nombre o número. */}
        {!rutaPropia && (
          <>
            <select
              name="modalidad"
              defaultValue={fModalidad}
              aria-label="Filtrar por modalidad"
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="">Modalidad: todas</option>
              {MODALIDADES.map((m) => (
                <option key={m} value={m}>
                  {modalidadLabel(m, "entrega")}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                name="problema"
                value="1"
                defaultChecked={soloProblema}
                className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
              />
              Con problema
            </label>
          </>
        )}

        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Buscar
        </button>
        {hayFiltro && (
          <Link
            href={href({
              q: undefined,
              repartidor: undefined,
              vendedor: undefined,
              modalidad: undefined,
              problema: undefined,
            })}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-brand"
          >
            Limpiar
          </Link>
        )}
      </form>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isRepartidor ? (verTodas ? "Toda la ruta" : "Mi ruta") : "Tablero de órdenes"}
        </h1>
        {(profile.role === "admin" || profile.role === "vendedor") && (
          <Link
            href="/ordenes/nueva"
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Nueva
          </Link>
        )}
      </div>

      <details className="group rounded-xl border border-gray-200 bg-white px-3 py-2 sm:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-gray-700">
          Filtros
          <ChevronDown
            className="h-4 w-4 text-gray-400 transition group-open:rotate-180"
            strokeWidth={2.25}
          />
        </summary>
        <div className="mt-3 space-y-3">{controles}</div>
      </details>
      <div className="hidden space-y-3 sm:block">{controles}</div>

      {formato === "tabla" ? (
        <TablaOrdenes orders={[...activasList, ...completadasList]} />
      ) : mostrarTodasLasColumnas ? (
        <div className="space-y-5">
          {/* Pedidos (Proveedor) primero: son los que más movimiento tienen. */}
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-white">
                P
              </span>
              Pedidos · Proveedor
            </h2>
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:snap-none sm:overflow-visible">
              <Column
                title="Pendientes"
                color="bg-gray-400"
                orders={activasDe("recojo", "pendiente")}
                detallado={detallado}
                {...fechas}
                separarNoRecogidos
              />
              <Column title="Asignadas" color="bg-amber-500" orders={activasDe("recojo", "asignado")} detallado={detallado} {...fechas} />
              <Column title="En Tránsito" color="bg-sky-500" orders={activasDe("recojo", "en_transito")} detallado={detallado} {...fechas} />
              <Column
                title={`Completadas · ${RANGO_LABEL[rango]}`}
                color="bg-green-500"
                orders={completadasDe("recojo")}
                detallado={detallado}
                {...fechas}
                usarCompletado
              />
            </div>
          </section>

          {/* Cotizaciones (Cliente): no pasan por "En Tránsito" — el cliente
              cuenta la mercadería en el momento de la entrega. */}
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
                S
              </span>
              Cotizaciones · Cliente
            </h2>
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:snap-none sm:overflow-visible">
              <Column title="Pendientes" color="bg-gray-400" orders={activasDe("entrega", "pendiente")} detallado={detallado} {...fechas} />
              <Column title="Asignadas" color="bg-amber-500" orders={activasDe("entrega", "asignado")} detallado={detallado} {...fechas} />
              <Column
                title={`Completadas · ${RANGO_LABEL[rango]}`}
                color="bg-green-500"
                orders={completadasDe("entrega")}
                detallado={detallado}
                {...fechas}
                usarCompletado
              />
            </div>
          </section>
        </div>
      ) : (
        /*
          Repartidor en "Mi ruta": una sola etapa por pantalla. Antes las tres
          columnas iban apiladas y en un celular había que scrollear de más
          para llegar a lo que le queda por hacer; ahora cada una es una
          pestaña de la barra inferior (ver NAV_REPARTIDOR en el layout).
        */
        <div className="sm:max-w-2xl">
          {panel === "por-hacer" && (
            <Column
              title="Por hacer"
              color="bg-amber-500"
              orders={byEstado("asignado")}
              detallado={detallado}
              {...fechas}
              fullWidthMobile
            />
          )}
          {/* Ya recogidas: salen de "Por hacer" al confirmar el recojo, pero
              siguen visibles porque si el material va directo al cliente es
              el propio repartidor quien la cierra al entregarla. */}
          {panel === "recogidas" && (
            <Column
              title="Recogidas (por cerrar)"
              color="bg-sky-500"
              orders={byEstado("en_transito")}
              detallado={detallado}
              {...fechas}
              fullWidthMobile
            />
          )}
          {panel === "completadas" && (
            <Column
              title={`Completadas · ${RANGO_LABEL[rango]}`}
              color="bg-green-500"
              orders={completadasList}
              detallado={detallado}
              {...fechas}
              usarCompletado
              fullWidthMobile
            />
          )}
        </div>
      )}
    </div>
  );
}
