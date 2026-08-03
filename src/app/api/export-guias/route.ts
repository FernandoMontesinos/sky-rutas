import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { construirConsulta, parseFiltros } from "@/lib/reportes";

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
  numero_guia: string | null;
  guia_url: string | null;
  guias_urls: string[] | null;
};

const SELECT_GUIAS = "id, numero_pedido, numero_guia, guia_url, guias_urls";

// Topes propios, mucho más bajos que el de Excel (LIMITE_FILAS = 5000):
// acá cada fila implica además descargar 1-3 fotos desde Storage antes de
// poder responder, así que el costo real es por foto, no por fila.
const LIMITE_ORDENES = 300;
const LIMITE_FOTOS = 600;
const LOTE_DESCARGA = 8;

function extDeUrl(url: string): string {
  const sinQuery = url.split("?")[0];
  const punto = sinQuery.lastIndexOf(".");
  return punto === -1 ? "jpg" : sinQuery.slice(punto + 1).toLowerCase();
}

/** Nombre de archivo seguro: solo letras/números/guiones, tope de largo. */
function sanear(s: string): string {
  const limpio = s.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return limpio.slice(0, 40) || "sin-dato";
}

async function enLotes<T, R>(items: T[], tamano: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = [];
  for (let i = 0; i < items.length; i += tamano) {
    const lote = items.slice(i, i + tamano);
    resultados.push(...(await Promise.all(lote.map(fn))));
  }
  return resultados;
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
  const filtros = parseFiltros(sp);

  // Se pide un tope más para poder distinguir "hay exactamente el tope" de
  // "hay más de lo que se puede procesar", sin una consulta de conteo aparte.
  const { data, error } = await construirConsulta(supabase, filtros, SELECT_GUIAS).limit(
    LIMITE_ORDENES + 1
  );
  if (error) return new NextResponse("No se pudo generar el ZIP", { status: 500 });
  const filas = (data ?? []) as unknown as FilaGuia[];

  if (filas.length > LIMITE_ORDENES) {
    return new NextResponse(
      `Hay más de ${LIMITE_ORDENES} órdenes en ese rango — acota el rango de fechas para descargar las guías.`,
      { status: 413 }
    );
  }

  // Cada orden puede aportar varias fotos de guía (marcarEnTransito y
  // completeOrder van sumando a guias_urls, no reemplazando), así que el
  // nombre de archivo tiene que ser por FOTO, no por orden — de lo
  // contrario la segunda foto de una misma orden pisa a la primera dentro
  // del ZIP. Se suma el numero_pedido (único) como sufijo estable: dos
  // órdenes con el mismo numero_guia (tipeo, copy-paste) no chocan entre sí.
  const fotos: { url: string; nombre: string }[] = [];
  for (const fila of filas) {
    const urls = fila.guias_urls?.length ? fila.guias_urls : fila.guia_url ? [fila.guia_url] : [];
    urls.forEach((url, idx) => {
      const base = `${sanear(fila.numero_pedido)}_${sanear(fila.numero_guia ?? "sin-guia")}`;
      fotos.push({ url, nombre: `${base}-${idx + 1}.${extDeUrl(url)}` });
    });
  }

  if (fotos.length === 0) {
    return new NextResponse("No hay fotos de guía en ese rango.", { status: 404 });
  }
  if (fotos.length > LIMITE_FOTOS) {
    return new NextResponse(
      `Hay más de ${LIMITE_FOTOS} fotos de guía en ese rango — acota el rango de fechas para descargarlas.`,
      { status: 413 }
    );
  }

  const zip = new JSZip();
  await enLotes(fotos, LOTE_DESCARGA, async ({ url, nombre }) => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error("[export-guias] no se pudo descargar", { url, status: res.status });
        return;
      }
      zip.file(nombre, await res.arrayBuffer());
    } catch (err) {
      console.error("[export-guias] error al descargar", { url, err });
    }
  });

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const nombreZip = `skyhigh-guias_${filtros.desde}_a_${filtros.hasta}.zip`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nombreZip}"`,
      "Cache-Control": "no-store",
    },
  });
}
