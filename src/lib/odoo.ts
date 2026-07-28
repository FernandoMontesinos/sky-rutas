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

export type CotizacionOdoo = {
  numero: string;
  cliente: string;
  montoTotal: number;
  estado: string;
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

/** Busca una cotización de Odoo (sale.order) por su número exacto. */
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
        fields: ["name", "state", "partner_id", "amount_total"],
        limit: 1,
      },
    },
    auth.cookie
  );

  const cotizacion = (
    busqueda.result as Array<{
      name: string;
      partner_id: [number, string] | false;
      amount_total: number;
      state: string;
    }>
  )[0];
  if (!cotizacion) return null;

  return {
    numero: cotizacion.name,
    cliente: cotizacion.partner_id ? cotizacion.partner_id[1] : "",
    montoTotal: cotizacion.amount_total,
    estado: ESTADO_LABEL[cotizacion.state] ?? cotizacion.state,
  };
}
