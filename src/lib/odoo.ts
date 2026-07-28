const ODOO_URL = process.env.ODOO_URL;
const ODOO_DB = process.env.ODOO_DB;
const ODOO_USER = process.env.ODOO_USER;
const ODOO_PASS = process.env.ODOO_PASS;

const ESTADO_LABEL: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada al cliente",
  sale: "Confirmada",
  done: "Completada",
  cancel: "Cancelada",
};

export type CompraCandidato = { proveedor: string; numeroPedido: string };

export type CotizacionOdoo = {
  numero: string;
  cliente: string;
  estado: string;
  proyecto: string | null;
  pdf: { base64: string; nombreArchivo: string } | null;
  compraCandidatos: CompraCandidato[];
};

async function odooCall(path: string, params: Record<string, unknown>, cookie?: string) {
  const res = await fetch(`${ODOO_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params }),
    signal: AbortSignal.timeout(15000),
  });
  const setCookie = res.headers.get("set-cookie");
  const json = await res.json();
  if (json.error) {
    throw new Error(json.error.data?.message || json.error.message || "Error de Odoo");
  }
  return { result: json.result, cookie: setCookie ? setCookie.split(";")[0] : cookie };
}

/** Genera y descarga el PDF de la cotización (mismo reporte que "Vista previa" en Odoo). */
async function fetchCotizacionPdf(
  cookie: string | undefined,
  saleOrderId: number,
  nombre: string
): Promise<{ base64: string; nombreArchivo: string } | null> {
  try {
    const res = await fetch(`${ODOO_URL}/report/pdf/sale.report_saleorder/${saleOrderId}`, {
      headers: cookie ? { Cookie: cookie } : {},
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("application/pdf")) {
      return null;
    }
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { base64, nombreArchivo: `${nombre}.pdf` };
  } catch (err) {
    console.error("No se pudo generar el PDF de la cotización en Odoo:", err);
    return null;
  }
}

/** Busca pedidos de compra (purchase.order) que mencionen esta cotización en su
 *  referencia interna. Es una heurística de texto libre (ver CONEXION_ODOO_API.md
 *  / handoff), no una relación garantizada — puede haber 0, 1 o varios candidatos. */
async function buscarPedidosCompraRelacionados(
  cookie: string | undefined,
  numero: string
): Promise<CompraCandidato[]> {
  try {
    const busqueda = await odooCall(
      "/web/dataset/call_kw",
      {
        model: "purchase.order",
        method: "search_read",
        args: [[["customer", "ilike", numero]]],
        kwargs: { fields: ["name", "partner_id"], order: "date_order desc", limit: 5 },
      },
      cookie
    );
    return (
      busqueda.result as Array<{ name: string; partner_id: [number, string] | false }>
    ).map((po) => ({
      proveedor: po.partner_id ? po.partner_id[1] : "",
      numeroPedido: po.name,
    }));
  } catch (err) {
    console.error("No se pudo buscar el pedido de compra relacionado en Odoo:", err);
    return [];
  }
}

/** Busca una cotización de Odoo (sale.order) por su número exacto, junto con todo
 *  lo que se pueda autocompletar a partir de ella (proyecto, PDF, compra asociada). */
export async function buscarCotizacion(numero: string): Promise<CotizacionOdoo | null> {
  const numeroLimpio = numero.trim();
  if (!numeroLimpio) return null;
  if (!ODOO_URL || !ODOO_DB || !ODOO_USER || !ODOO_PASS) {
    throw new Error("Conexión a Odoo no configurada (faltan variables de entorno).");
  }

  const auth = await odooCall("/web/session/authenticate", {
    db: ODOO_DB,
    login: ODOO_USER,
    password: ODOO_PASS,
  });
  if (!auth.result?.uid) throw new Error("Credenciales de Odoo inválidas.");

  const busqueda = await odooCall(
    "/web/dataset/call_kw",
    {
      model: "sale.order",
      method: "search_read",
      args: [[["name", "=ilike", numeroLimpio]]],
      kwargs: {
        fields: ["id", "name", "state", "partner_id", "project_id"],
        limit: 1,
      },
    },
    auth.cookie
  );

  const cotizacion = (
    busqueda.result as Array<{
      id: number;
      name: string;
      partner_id: [number, string] | false;
      state: string;
      project_id: [number, string] | false;
    }>
  )[0];
  if (!cotizacion) return null;

  // El PDF y la búsqueda del pedido de compra son "mejor esfuerzo": si alguno
  // falla, no debe tumbar el resto de datos que ya se obtuvieron arriba.
  const [pdfResult, compraResult] = await Promise.allSettled([
    fetchCotizacionPdf(auth.cookie, cotizacion.id, cotizacion.name),
    buscarPedidosCompraRelacionados(auth.cookie, cotizacion.name),
  ]);

  return {
    numero: cotizacion.name,
    cliente: cotizacion.partner_id ? cotizacion.partner_id[1] : "",
    estado: ESTADO_LABEL[cotizacion.state] ?? cotizacion.state,
    proyecto: cotizacion.project_id ? cotizacion.project_id[1] : null,
    pdf: pdfResult.status === "fulfilled" ? pdfResult.value : null,
    compraCandidatos: compraResult.status === "fulfilled" ? compraResult.value : [],
  };
}
