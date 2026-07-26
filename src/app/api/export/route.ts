import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { construirConsulta, fechaHoraLima, parseFiltros, type ReporteRow } from "@/lib/reportes";
import { MODALIDAD_SHORT, STATUS_LABEL, TYPE_LABEL } from "@/lib/types";

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

const COLUMNAS: Columna[] = [
  { header: "N° pedido", width: 16, valor: (r) => r.numero_pedido },
  { header: "Tipo", width: 10, valor: (r) => TYPE_LABEL[r.tipo] },
  { header: "Estado", width: 12, valor: (r) => STATUS_LABEL[r.estado] },
  { header: "Entrega parcial", width: 14, valor: (r) => (r.entrega_parcial ? "Sí" : "No") },
  { header: "Es remanente", width: 13, valor: (r) => (r.parent_order_id ? "Sí" : "No") },
  { header: "Cliente / Proveedor", width: 38, valor: (r) => r.cliente ?? "" },
  { header: "Proyecto", width: 30, valor: (r) => r.proyecto ?? "" },
  { header: "Proveedor de compra", width: 24, valor: (r) => r.proveedor ?? "" },
  { header: "N° pedido de compra", width: 18, valor: (r) => r.numero_pedido_compra ?? "" },
  { header: "Modalidad", width: 12, valor: (r) => MODALIDAD_SHORT[r.modalidad] },
  { header: "Tracking courier", width: 18, valor: (r) => r.courier_tracking ?? "" },
  { header: "Creado por", width: 20, valor: (r) => r.creador?.full_name ?? "" },
  { header: "Repartidor", width: 20, valor: (r) => r.repartidor?.full_name ?? "" },
  { header: "Fecha de creación", width: 18, valor: (r) => fechaHoraLima(r.created_at) },
  { header: "Fecha de asignación", width: 18, valor: (r) => fechaHoraLima(r.assigned_at) },
  { header: "Fecha de completado", width: 18, valor: (r) => fechaHoraLima(r.completed_at) },
];

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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SkyHigh Rutas";
  const hoja = workbook.addWorksheet("Órdenes");

  hoja.columns = COLUMNAS.map((c) => ({ header: c.header, width: c.width }));

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true };
  encabezado.alignment = { vertical: "middle" };
  // Encabezado siempre visible al hacer scroll, y filtros de Excel listos.
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNAS.length } };

  for (const r of rows) {
    hoja.addRow(COLUMNAS.map((c) => c.valor(r)));
  }

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
