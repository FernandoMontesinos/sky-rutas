import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jpegsAPdf } from "@/lib/jpeg-a-pdf";

// Lee cookies y querystring: siempre por request, nunca prerenderizado.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Devuelve la guía de una orden como PDF de una sola pieza, con una página
 * por foto. La guía se toma con la cámara del celular, así que queda como
 * imagen; quien la archiva o la manda por correo necesita un PDF.
 *
 * Si la guía YA es un PDF (se adjuntó desde una PC), se devuelve tal cual,
 * sin volver a procesarla.
 */
export async function GET(request: NextRequest) {
  // Cualquier usuario con sesión puede ver la orden (orders_select es "true"
  // para autenticados), así que basta con exigir sesión: no añadimos aquí una
  // regla de rol que la propia ficha de la orden no aplica.
  await requireUser();

  const orderId = request.nextUrl.searchParams.get("orden");
  if (!orderId) {
    return NextResponse.json({ error: "Falta el parámetro 'orden'." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("numero_pedido, numero_guia, guia_url, guias_urls")
    .eq("id", orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
  }

  const urls: string[] = order.guias_urls?.length
    ? order.guias_urls
    : order.guia_url
      ? [order.guia_url]
      : [];

  if (urls.length === 0) {
    return NextResponse.json({ error: "Esta orden todavía no tiene guía." }, { status: 404 });
  }

  const nombre = `guia-${order.numero_guia || order.numero_pedido}.pdf`.replace(
    /[^\w.-]+/g,
    "-"
  );

  const esPdf = (u: string) => u.split("?")[0].toLowerCase().endsWith(".pdf");

  // Ya venía en PDF: se reenvía el original en vez de rearmarlo.
  const soloPdfs = urls.every(esPdf);
  if (soloPdfs) {
    const respuesta = await fetch(urls[0]);
    if (!respuesta.ok) {
      return NextResponse.json({ error: "No se pudo leer la guía." }, { status: 502 });
    }
    return new NextResponse(await respuesta.arrayBuffer(), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombre}"`,
      },
    });
  }

  const imagenes: Uint8Array[] = [];
  for (const url of urls.filter((u) => !esPdf(u))) {
    const respuesta = await fetch(url);
    if (!respuesta.ok) continue;
    imagenes.push(new Uint8Array(await respuesta.arrayBuffer()));
  }

  if (imagenes.length === 0) {
    return NextResponse.json({ error: "No se pudo leer la guía." }, { status: 502 });
  }

  try {
    const pdf = jpegsAPdf(imagenes);
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo convertir la guía a PDF." },
      { status: 500 }
    );
  }
}
