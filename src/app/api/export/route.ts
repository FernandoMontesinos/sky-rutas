import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { construirConsulta, fechaHoraLima, parseFiltros, type ReporteRow } from "@/lib/reportes";
// La columna "Tipo" desaparece: ahora el tipo es la hoja.
import { MODALIDAD_SHORT, STATUS_LABEL } from "@/lib/types";

// Lee cookies y querystring: siempre se resuelve por request, nunca se prerenderiza.
export const dynamic = "force-dynamic";

/**
 * Exporta la data cruda de las órdenes a un .xlsx real (no un HTML con
 * extensión .xls, que hacía que Excel avisara "el formato no coincide").
 * Respeta exactamente los mismos filtros que la pantalla de Reportes.
 */

type Columna = {
  header: string;
  width: number;
  valor: (r: ReporteRow) => string;
};

/** Columnas comunes a los dos tipos de orden. */
const BASE_INICIO: Columna[] = [
  { header: "N° pedido", width: 16, valor: (r) => r.numero_pedido },
  { header: "Estado", width: 12, valor: (r) => STATUS_LABEL[r.estado] },
  { header: "Cliente / Proveedor", width: 38, valor: (r) => r.cliente ?? "" },
];

/**
 * "División" reemplaza a la vieja columna "Es remanente", que se calculaba con
 * parent_order_id. Desde que los envíos planificados también usan
 * parent_order_id, esa columna habría marcado como remanente a órdenes que no
 * fallaron — justo el dato que se quiere medir.
 */
const BASE_FIN: Columna[] = [
  { header: "Modalidad", width: 12, valor: (r) => MODALIDAD_SHORT[r.modalidad] },
  { header: "Tracking courier", width: 18, valor: (r) => r.courier_tracking ?? "" },
  { header: "Entrega parcial", width: 14, valor: (r) => (r.entrega_parcial ? "Sí" : "No") },
  {
    header: "División",
    width: 18,
    valor: (r) =>
      r.division_tipo === "envio"
        ? "Envío planificado"
        : r.division_tipo === "remanente"
          ? "Remanente por error"
          : "",
  },
  { header: "Creado por", width: 20, valor: (r) => r.creador?.full_name ?? "" },
  { header: "Repartidor", width: 20, valor: (r) => r.repartidor?.full_name ?? "" },
  { header: "Fecha de creación", width: 18, valor: (r) => fechaHoraLima(r.created_at) },
  { header: "Fecha de asignación", width: 18, valor: (r) => fechaHoraLima(r.assigned_at) },
  { header: "Fecha de completado", width: 18, valor: (r) => fechaHoraLima(r.completed_at) },
];

/**
 * Cotizaciones (Cliente): llevan proyecto y la compra a proveedor asociada, y
 * son las únicas que llevan guía — la emite SkyHigh y solo aplica a
 * clientes, la del proveedor nunca se registra. El N° es el puente con la
 * descarga de guías: es el nombre de la carpeta dentro del ZIP, así que
 * desde una fila del Excel se llega a sus fotos sin tener que adivinar.
 */
const COLUMNAS_COTIZACION: Columna[] = [
  ...BASE_INICIO,
  { header: "Proyecto", width: 30, valor: (r) => r.proyecto ?? "" },
  { header: "Proveedor de compra", width: 24, valor: (r) => r.proveedor ?? "" },
  { header: "N° pedido de compra", width: 18, valor: (r) => r.numero_pedido_compra ?? "" },
  { header: "N° de guía", width: 16, valor: (r) => r.numero_guia ?? "" },
  ...BASE_FIN,
];

/**
 * Pedidos (Proveedor): sin proyecto ni compra asociada (createOrder los fuerza
 * a null en un recojo, así que en una sola hoja esas columnas salían siempre
 * vacías), y con lo propio del recojo: fecha de recojo e intentos fallidos.
 */
const COLUMNAS_PEDIDO: Columna[] = [
  ...BASE_INICIO,
  ...BASE_FIN,
  { header: "Fecha de recojo", width: 18, valor: (r) => fechaHoraLima(r.en_transito_at) },
  {
    header: "Intentos fallidos",
    width: 15,
    valor: (r) => (r.no_recogido_intentos > 0 ? String(r.no_recogido_intentos) : ""),
  },
  { header: "Motivo del último fallo", width: 40, valor: (r) => r.no_recogido_motivo ?? "" },
];

/**
 * CSV: una sola tabla con todo, porque el formato no admite varias hojas.
 * Se agrega "Tipo" al inicio para no perder la distinción que en el .xlsx
 * la da la hoja, y las columnas propias de cada tipo salen vacías donde no
 * aplican (es el precio de tenerlo en un solo archivo plano).
 */
const COLUMNAS_CSV: Columna[] = [
  {
    header: "Tipo",
    width: 14,
    valor: (r) => (r.tipo === "entrega" ? "Cotización" : "Pedido"),
  },
  ...BASE_INICIO,
  { header: "Proyecto", width: 30, valor: (r) => r.proyecto ?? "" },
  { header: "Proveedor de compra", width: 24, valor: (r) => r.proveedor ?? "" },
  { header: "N° pedido de compra", width: 18, valor: (r) => r.numero_pedido_compra ?? "" },
  { header: "N° de guía", width: 16, valor: (r) => r.numero_guia ?? "" },
  ...BASE_FIN,
  { header: "Fecha de recojo", width: 18, valor: (r) => fechaHoraLima(r.en_transito_at) },
  {
    header: "Intentos fallidos",
    width: 15,
    valor: (r) => (r.no_recogido_intentos > 0 ? String(r.no_recogido_intentos) : ""),
  },
  { header: "Motivo del último fallo", width: 40, valor: (r) => r.no_recogido_motivo ?? "" },
];

/** Escapa un valor para CSV (comillas dobles y separador dentro del texto). */
function celdaCsv(v: string) {
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Se usa punto y coma, no coma: Excel en configuración regional de Perú
 * (y España) espera `;` y con `,` mete todo en una sola columna. El BOM del
 * inicio es lo que hace que Excel lea el archivo como UTF-8 — sin él, las
 * tildes y las eñes salen rotas.
 */
function armarCsv(filas: ReporteRow[]) {
  const lineas = [
    COLUMNAS_CSV.map((c) => celdaCsv(c.header)).join(";"),
    ...filas.map((r) => COLUMNAS_CSV.map((c) => celdaCsv(c.valor(r))).join(";")),
  ];
  return "﻿" + lineas.join("\r\n");
}

/** Arma una hoja con encabezado congelado y autofiltro. */
function armarHoja(
  workbook: ExcelJS.Workbook,
  nombre: string,
  columnas: Columna[],
  filas: ReporteRow[]
) {
  const hoja = workbook.addWorksheet(nombre);
  hoja.columns = columnas.map((c) => ({ header: c.header, width: c.width }));

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true };
  encabezado.alignment = { vertical: "middle" };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };

  for (const r of filas) {
    hoja.addRow(columnas.map((c) => c.valor(r)));
  }
}

export async function GET(request: NextRequest) {
  // Autorización: solo almacén/admin (mismos roles que la pantalla de Reportes).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("No autorizado", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "almacen"].includes(profile.role as string)) {
    return new NextResponse("Sin permiso", { status: 403 });
  }

  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const filtros = parseFiltros(sp);

  const { data, error } = await construirConsulta(supabase, filtros);
  if (error) return new NextResponse("No se pudo generar el reporte", { status: 500 });
  const rows = (data ?? []) as unknown as ReporteRow[];

  if (sp.formato === "csv") {
    const nombreCsv = `skyhigh-ordenes_${filtros.desde}_a_${filtros.hasta}.csv`;
    return new NextResponse(armarCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombreCsv}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SkyHigh Rutas";

  // Dos hojas, igual que los dos tableros: cada tipo de orden tiene columnas
  // que al otro no le aplican, y en una sola hoja la mitad salía siempre vacía.
  armarHoja(
    workbook,
    "Cotizaciones",
    COLUMNAS_COTIZACION,
    rows.filter((r) => r.tipo === "entrega")
  );
  armarHoja(
    workbook,
    "Pedidos",
    COLUMNAS_PEDIDO,
    rows.filter((r) => r.tipo === "recojo")
  );

  const buffer = await workbook.xlsx.writeBuffer();
  // exceljs devuelve un Buffer/ArrayBuffer según el entorno; Uint8Array
  // acepta ambos y es un body válido para Response.
  const bytes = new Uint8Array(buffer as unknown as ArrayBuffer);

  const nombre = `skyhigh-ordenes_${filtros.desde}_a_${filtros.hasta}.xlsx`;

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
