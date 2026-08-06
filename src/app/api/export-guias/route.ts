import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { construirConsulta, fechaHoraLima, parseFiltros } from "@/lib/reportes";

// Lee cookies y querystring: siempre se resuelve por request, nunca se prerenderiza.
export const dynamic = "force-dynamic";
// Traer y comprimir varias fotos puede tardar más que el default de la
// plataforma — se declara explícito en vez de confiar en el valor por
// defecto (que en Hobby es 10s de todas formas, pero documenta la
// intención para cuando el plan lo permita).
export const maxDuration = 60;

type FilaGuia = {
  id: string;
  numero_pedido: string;
  tipo: "entrega" | "recojo";
  cliente: string | null;
  numero_guia: string | null;
  completed_at: string | null;
  guia_url: string | null;
  guias_urls: string[] | null;
  material_urls: string[] | null;
};

const SELECT_GUIAS =
  "id, numero_pedido, tipo, cliente, numero_guia, completed_at, guia_url, guias_urls, material_urls";

// Topes propios, mucho más bajos que el de Excel (LIMITE_FILAS = 5000):
// acá cada fila implica además descargar sus fotos desde Storage antes de
// poder responder, así que el costo real es por foto, no por fila.
const LIMITE_ORDENES = 300;
const LIMITE_FOTOS = 600;
const LOTE_DESCARGA = 8;

function extDeUrl(url: string): string {
  const sinQuery = url.split("?")[0];
  const punto = sinQuery.lastIndexOf(".");
  return punto === -1 ? "jpg" : sinQuery.slice(punto + 1).toLowerCase();
}

/** Nombre seguro para carpeta/archivo en Windows, Mac y Linux. */
function sanear(s: string): string {
  const limpio = s.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
  return limpio.slice(0, 60) || "sin-dato";
}

function celdaCsv(v: string) {
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function enLotes<T, R>(items: T[], tamano: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = [];
  for (let i = 0; i < items.length; i += tamano) {
    resultados.push(...(await Promise.all(items.slice(i, i + tamano).map(fn))));
  }
  return resultados;
}

/** Las guías de una orden, con el respaldo al campo viejo de una sola guía. */
function guiasDe(f: FilaGuia): string[] {
  return f.guias_urls?.length ? f.guias_urls : f.guia_url ? [f.guia_url] : [];
}

export async function GET(request: NextRequest) {
  // Autorización: solo almacén/admin (mismos roles que /api/export).
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
  const ordenId = sp.orden?.trim();

  let filas: FilaGuia[];
  let nombreZip: string;

  if (ordenId) {
    // Modo "una sola orden": el botón que vive en la ficha. Sin filtros de
    // fecha ni topes — es una orden, y quien la está mirando ya la eligió.
    const { data, error } = await supabase
      .from("orders")
      .select(SELECT_GUIAS)
      .eq("id", ordenId)
      .maybeSingle();
    if (error) return new NextResponse("No se pudo generar el ZIP", { status: 500 });
    if (!data) return new NextResponse("Orden no encontrada", { status: 404 });
    filas = [data as unknown as FilaGuia];
    nombreZip = `guias_${sanear(filas[0].numero_pedido)}.zip`;
  } else {
    const filtros = parseFiltros(sp);
    // Se pide un tope más para distinguir "hay exactamente el tope" de "hay
    // más de lo que se puede procesar", sin una consulta de conteo aparte.
    const { data, error } = await construirConsulta(supabase, filtros, SELECT_GUIAS).limit(
      LIMITE_ORDENES + 1
    );
    if (error) return new NextResponse("No se pudo generar el ZIP", { status: 500 });
    filas = (data ?? []) as unknown as FilaGuia[];

    if (filas.length > LIMITE_ORDENES) {
      return new NextResponse(
        `Hay más de ${LIMITE_ORDENES} órdenes en ese rango — acota el rango de fechas para descargar las guías.`,
        { status: 413 }
      );
    }
    nombreZip = `skyhigh-guias_${filtros.desde}_a_${filtros.hasta}.zip`;
  }

  // Una carpeta por orden, nombrada "N°pedido_N°guía". Dentro, los archivos
  // numerados por tipo: guia-1, guia-2, material-1… Antes iba todo plano y
  // con el nombre armado solo desde el N° de guía, así que dos fotos de la
  // misma orden se pisaban entre sí y no había forma de saber cuál era cuál.
  const archivos: { url: string; ruta: string }[] = [];
  const indice: string[][] = [];

  for (const f of filas) {
    const guias = guiasDe(f);
    const material = f.material_urls ?? [];
    if (guias.length === 0 && material.length === 0) continue;

    // Un Pedido nunca tiene N° de guía (la emite SkyHigh y solo aplica a
    // clientes), así que ahí la carpeta va solo con el N° de pedido — un
    // sufijo "sin-guia" se leería como un dato faltante, y no lo es.
    const carpeta =
      f.tipo === "recojo"
        ? sanear(f.numero_pedido)
        : `${sanear(f.numero_pedido)}_${sanear(f.numero_guia ?? "sin-guia")}`;
    guias.forEach((url, i) =>
      archivos.push({ url, ruta: `${carpeta}/guia-${i + 1}.${extDeUrl(url)}` })
    );
    material.forEach((url, i) =>
      archivos.push({ url, ruta: `${carpeta}/material-${i + 1}.${extDeUrl(url)}` })
    );

    indice.push([
      f.numero_pedido,
      f.tipo === "entrega" ? "Cotización" : "Pedido",
      f.cliente ?? "",
      f.numero_guia ?? "",
      fechaHoraLima(f.completed_at),
      carpeta,
      String(guias.length),
      String(material.length),
    ]);
  }

  if (archivos.length === 0) {
    return new NextResponse("No hay fotos de guía ni de material en esa selección.", {
      status: 404,
    });
  }
  if (archivos.length > LIMITE_FOTOS) {
    return new NextResponse(
      `Hay más de ${LIMITE_FOTOS} fotos en ese rango — acota el rango de fechas para descargarlas.`,
      { status: 413 }
    );
  }

  const zip = new JSZip();

  // Índice del contenido: sin esto el ZIP se explica solo a medias (qué
  // carpeta es de qué cliente, cuándo se cerró). Mismo formato que el CSV de
  // órdenes: punto y coma + BOM, para que Excel lo abra bien de una.
  const cabecera = [
    "N° pedido",
    "Tipo",
    "Cliente / Proveedor",
    "N° de guía",
    "Fecha de completado",
    "Carpeta",
    "Fotos de guía",
    "Fotos de material",
  ];
  zip.file(
    "resumen.csv",
    "﻿" +
      [cabecera, ...indice].map((f) => f.map(celdaCsv).join(";")).join("\r\n")
  );

  await enLotes(archivos, LOTE_DESCARGA, async ({ url, ruta }) => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error("[export-guias] no se pudo descargar", { url, status: res.status });
        return;
      }
      zip.file(ruta, await res.arrayBuffer());
    } catch (err) {
      console.error("[export-guias] error al descargar", { url, err });
    }
  });

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nombreZip}"`,
      "Cache-Control": "no-store",
    },
  });
}
