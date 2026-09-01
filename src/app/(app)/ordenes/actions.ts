"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notify, userIdsByRole } from "@/lib/notify";
import { DIVISION_SUFIJO, type DivisionTipo } from "@/lib/types";
import { CAMPO_LABEL, registrarEvento, registrarEventos } from "@/lib/historial";

export type FormResult = { error?: string; ok?: boolean };

function extFromType(type: string, fallback: string) {
  const ext = type.split("/")[1];
  if (!ext) return fallback;
  return ext === "jpeg" ? "jpg" : ext;
}

/** Escapa los comodines de LIKE para que un número con "%" o "_" no traiga de más. */
function escaparLike(texto: string) {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Número de la orden raíz: sube por parent_order_id hasta la primera orden sin
 * padre. El tope de saltos es una red de seguridad — parent_order_id es una FK
 * autorreferente sin protección de ciclos, así que un dato torcido (A→B→A) no
 * debe colgar la petición.
 */
async function numeroRaiz(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  numeroActual: string
): Promise<string> {
  let id = orderId;
  let numero = numeroActual;
  for (let salto = 0; salto < 10; salto++) {
    const { data } = await supabase
      .from("orders")
      .select("parent_order_id, numero_pedido")
      .eq("id", id)
      .single();
    if (!data?.parent_order_id) return numero;
    const { data: padre } = await supabase
      .from("orders")
      .select("id, numero_pedido")
      .eq("id", data.parent_order_id)
      .single();
    if (!padre) return numero;
    id = padre.id;
    numero = padre.numero_pedido;
  }
  return numero;
}

/**
 * Siguiente número libre para una orden hija: S14665-R1, S14665-R2… (remanentes
 * por error) y en paralelo S14665-E1, S14665-E2… (envíos planificados).
 *
 * Busca por PREFIJO en vez de contar hijas, a propósito. Contar se rompe de
 * varias formas: si un admin borra una hija intermedia el conteo retrocede y
 * reemite un número que sigue vivo; si se borra un nodo intermedio sus hijas
 * quedan huérfanas (parent_order_id es ON DELETE SET NULL) y dejan de contarse
 * aunque conserven su número; y no ve un número tipeado a mano por un vendedor.
 * Mirar el máximo sufijo realmente emitido cubre los tres casos.
 */
async function siguienteNumeroDivision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  numeroActual: string,
  tipo: DivisionTipo
): Promise<string> {
  const raiz = await numeroRaiz(supabase, orderId, numeroActual);
  const sufijo = DIVISION_SUFIJO[tipo];

  const { data: familia } = await supabase
    .from("orders")
    .select("numero_pedido")
    .ilike("numero_pedido", `${escaparLike(raiz)}-${sufijo}%`);

  const patron = new RegExp(`^${raiz.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-${sufijo}(\\d+)$`, "i");
  let maximo = 0;
  for (const o of familia ?? []) {
    const m = patron.exec(o.numero_pedido);
    if (m) maximo = Math.max(maximo, parseInt(m[1], 10));
  }
  return `${raiz}-${sufijo}${maximo + 1}`;
}

/**
 * Crea la orden hija copiando los datos del padre. Reintenta si el número ya
 * estaba tomado (23505 contra el índice único): entre calcular el número y
 * escribirlo hay dos peticiones distintas, así que dos divisiones simultáneas
 * pueden pedir el mismo.
 */
async function crearOrdenHija(
  supabase: Awaited<ReturnType<typeof createClient>>,
  padre: {
    id: string;
    numero_pedido: string;
    cliente: string | null;
    proyecto: string | null;
    proveedor: string | null;
    numero_pedido_compra: string | null;
    tipo: string;
    modalidad: string;
    courier_tracking: string | null;
    imagen_url: string | null;
    imagenes_urls: string[] | null;
    created_by: string | null;
  },
  tipo: DivisionTipo,
  nota: string
): Promise<{ id: string; numero: string } | { error: string }> {
  for (let intento = 0; intento < 3; intento++) {
    const numero = await siguienteNumeroDivision(supabase, padre.id, padre.numero_pedido, tipo);
    const { data, error } = await supabase
      .from("orders")
      .insert({
        numero_pedido: numero,
        cliente: padre.cliente,
        proyecto: padre.proyecto,
        proveedor: padre.proveedor,
        numero_pedido_compra: padre.numero_pedido_compra,
        tipo: padre.tipo,
        modalidad: padre.modalidad,
        courier_tracking: padre.courier_tracking,
        imagen_url: padre.imagen_url,
        imagenes_urls: padre.imagenes_urls,
        nota,
        created_by: padre.created_by,
        parent_order_id: padre.id,
        division_tipo: tipo,
        estado: "pendiente",
      })
      .select("id")
      .single();

    if (!error && data) return { id: data.id, numero };
    // 23505 = número ya tomado: alguien más dividió al mismo tiempo, o el
    // número existe a mano. Se recalcula y se vuelve a intentar.
    if (error?.code !== "23505") {
      return { error: error?.message ?? "No se pudo crear la orden." };
    }
  }
  return { error: "No se pudo asignar un número libre para la orden nueva." };
}

/** Sube varios archivos a un bucket y devuelve sus URLs públicas, en orden. */
async function uploadMany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: string,
  folder: string,
  files: File[]
): Promise<{ urls: string[]; error?: string }> {
  const urls: string[] = [];
  for (const f of files) {
    const path = `${folder}/${Date.now()}-${urls.length}.${extFromType(f.type, "jpg")}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, f, { contentType: f.type, upsert: false });
    if (error) return { urls, error: error.message };
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    urls.push(pub.publicUrl);
  }
  return { urls };
}

/** Vendedor/Admin crea una orden con una o más imágenes. */
export async function createOrder(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  // Almacén también crea órdenes para casos especiales (p. ej. mandar a
  // bordar): no toda orden nace de una venta. Editar datos de la venta sigue
  // siendo solo de Ventas/Admin (ver editarOrden).
  const { userId } = await requireRole(["vendedor", "almacen", "admin"]);

  const numero = String(formData.get("numero_pedido") ?? "").trim();
  const cliente = String(formData.get("cliente") ?? "").trim() || null;
  const proyecto = String(formData.get("proyecto") ?? "").trim() || null;
  const tipo = String(formData.get("tipo") ?? "");
  const modalidad = String(formData.get("modalidad") ?? "reparto");
  const courierTracking = String(formData.get("courier_tracking") ?? "").trim() || null;
  // Proveedor/pedido de compra: solo aplica a una entrega (venta) que además
  // requirió comprarle a un proveedor. En un recojo, ya se usa cliente/numero
  // como proveedor/pedido (ver etiquetas dinámicas en el formulario).
  const requiereCompra = formData.get("requiere_compra") === "1";
  const proveedor = String(formData.get("proveedor") ?? "").trim() || null;
  const numeroPedidoCompra = String(formData.get("numero_pedido_compra") ?? "").trim() || null;
  const nota = String(formData.get("nota") ?? "").trim() || null;
  const imagenes = formData.getAll("imagenes").filter((f): f is File => f instanceof File && f.size > 0);

  if (!numero) return { error: "Ingresa el número de pedido." };
  // El sufijo -R#/-E# identifica una orden hija generada por el sistema
  // (remanente o envío dividido). Si se permitiera tipearlo a mano, dos
  // números iguales (uno real, uno tipeado) podrían chocar más adelante
  // con el que arma siguienteNumeroDivision() para esa misma familia.
  const SUFIJO_DIVISION = new RegExp(`-(${Object.values(DIVISION_SUFIJO).join("|")})\\d+$`, "i");
  if (SUFIJO_DIVISION.test(numero))
    return {
      error: `El número no puede terminar en "-${numero.match(SUFIJO_DIVISION)?.[1]?.toUpperCase()}#": ese sufijo lo asigna el sistema al dividir un envío.`,
    };
  if (tipo !== "entrega" && tipo !== "recojo")
    return { error: "Selecciona si es CLIENTE o PROVEEDOR." };
  if (!["reparto", "oficina", "courier"].includes(modalidad))
    return { error: "Modalidad de entrega inválida." };
  if (imagenes.length === 0)
    return { error: "Agrega al menos una imagen de la orden (pégala o toma una foto)." };
  // Defensa en el servidor: el checkbox ya lo exige en el navegador, pero
  // no hay que confiar solo en la validación del cliente.
  if (tipo === "entrega" && requiereCompra && !proveedor)
    return { error: "Ingresa el nombre del proveedor." };

  const supabase = await createClient();

  // Bloquear duplicados: chequeo previo (buen mensaje) + el índice único
  // en la base como red de seguridad ante dos creaciones simultáneas.
  const { data: existente } = await supabase
    .from("orders")
    .select("id")
    .ilike("numero_pedido", escaparLike(numero))
    .maybeSingle();
  if (existente) {
    return { error: `Ya existe un pedido con el número "${numero}". Revisa que no sea un duplicado.` };
  }

  const { urls, error: upErr } = await uploadMany(supabase, "ordenes", userId, imagenes);
  if (upErr) return { error: "No se pudo subir la imagen: " + upErr };

  const { data: inserted, error: insErr } = await supabase
    .from("orders")
    .insert({
      numero_pedido: numero,
      cliente,
      // El proyecto solo tiene sentido cuando se atiende a un cliente (venta).
      proyecto: tipo === "entrega" ? proyecto : null,
      tipo,
      modalidad,
      courier_tracking: modalidad === "courier" ? courierTracking : null,
      proveedor: tipo === "entrega" ? proveedor : null,
      numero_pedido_compra: tipo === "entrega" ? numeroPedidoCompra : null,
      nota,
      imagen_url: urls[0] ?? null,
      imagenes_urls: urls,
      created_by: userId,
      estado: "pendiente",
    })
    .select("id")
    .single();
  if (insErr) {
    if (insErr.code === "23505") {
      return { error: `Ya existe un pedido con el número "${numero}". Revisa que no sea un duplicado.` };
    }
    return { error: insErr.message };
  }

  await registrarEvento(supabase, inserted.id, "creada");

  const almacenIds = await userIdsByRole("almacen");
  await notify(almacenIds, {
    tipo: "orden_pendiente",
    titulo: "Nueva orden pendiente",
    mensaje: `#${numero}${cliente ? " · " + cliente : ""} — falta asignar repartidor.`,
    orderId: inserted.id,
  });

  revalidatePath("/ordenes");
  redirect("/ordenes");
}

/** Almacén/Admin asigna (o desasigna) una orden a un repartidor. */
export async function assignOrder(formData: FormData): Promise<void> {
  await requireRole(["almacen", "admin"]);

  const orderId = String(formData.get("order_id") ?? "");
  const repartidorId = String(formData.get("repartidor_id") ?? "");
  if (!orderId) return;

  const supabase = await createClient();

  if (!repartidorId) {
    await supabase
      .from("orders")
      .update({ assigned_to: null, estado: "pendiente", assigned_at: null })
      .eq("id", orderId);
    await registrarEvento(supabase, orderId, "desasignada");
  } else {
    const { data: updated } = await supabase
      .from("orders")
      .update({
        assigned_to: repartidorId,
        estado: "asignado",
        assigned_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select("numero_pedido, cliente, repartidor:profiles!orders_assigned_to_fkey(full_name)")
      .single();

    if (updated) {
      const nombre = (updated.repartidor as unknown as { full_name: string } | null)?.full_name;
      await registrarEvento(supabase, orderId, "asignada", nombre ?? null);
      await notify([repartidorId], {
        tipo: "orden_asignada",
        titulo: "Te asignaron una orden",
        mensaje: `#${updated.numero_pedido}${updated.cliente ? " · " + updated.cliente : ""}`,
        orderId,
      });
    }
  }

  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath("/ordenes");
}

/** Almacén/Admin fija la modalidad de entrega (reparto / oficina / courier). */
export async function updateModalidad(formData: FormData): Promise<void> {
  await requireRole(["almacen", "admin"]);

  const orderId = String(formData.get("order_id") ?? "");
  const modalidad = String(formData.get("modalidad") ?? "");
  const tracking = String(formData.get("courier_tracking") ?? "").trim() || null;
  if (!orderId) return;
  if (!["reparto", "oficina", "courier"].includes(modalidad)) return;

  const supabase = await createClient();
  await supabase
    .from("orders")
    .update({
      modalidad,
      courier_tracking: modalidad === "courier" ? tracking : null,
    })
    .eq("id", orderId);

  await registrarEvento(supabase, orderId, "modalidad", modalidad);

  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath("/ordenes");
}

/**
 * El repartidor confirma que recogió (Pedido) o va a entregar (Cotización),
 * subiendo evidencia. NO cierra la orden ni decide completo/parcial a
 * propósito: en un Pedido recibe bultos sellados y no cuenta los ítems; en
 * una Cotización, quien de verdad cuenta y decide es Almacén al cerrar. La
 * orden queda "En Tránsito" hasta que Almacén (o Admin) la cierre con
 * `completeOrder`.
 *
 * La guía de remisión la emite SkyHigh y solo aplica a una Cotización — la
 * del proveedor nunca se registra, así que un Pedido no pide guía acá. En una
 * Cotización sí se pide la foto de la guía (obligatoria); el número escrito
 * es opcional — si falta, Almacén lo completa al cerrar.
 */
export async function marcarEnTransito(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  await requireRole(["repartidor", "almacen", "admin"]);

  const orderId = String(formData.get("order_id") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim();
  const numeroGuiaInput = String(formData.get("numero_guia") ?? "").trim();
  // Solo en un Pedido (Proveedor): el repartidor recibe bultos y sí sabe si el
  // proveedor le entregó todo o solo parte, aunque no cuente ítems. Es un
  // AVISO para almacén, no el cierre: quien decide el parcial definitivo (y
  // genera el remanente) sigue siendo almacén al contar. Ver nota más abajo.
  const recojoParcial = String(formData.get("recojo_parcial") ?? "") === "true";
  const notaFaltante = String(formData.get("nota_faltante") ?? "").trim();
  const guias = formData.getAll("guias").filter((f): f is File => f instanceof File && f.size > 0);
  const material = formData.getAll("material").filter((f): f is File => f instanceof File && f.size > 0);

  if (!orderId) return { error: "Orden inválida." };

  const supabase = await createClient();

  // La misma carrera que ya se blindó en completeOrder/dividirEnvio: sin
  // este chequeo, un reintento de red tardío (o una pestaña vieja) podía
  // reescribir a "en_transito" una orden que almacén ya había cerrado.
  const { data: actual } = await supabase
    .from("orders")
    .select("id, estado, tipo, guias_urls, guia_url, numero_guia")
    .eq("id", orderId)
    .single();
  if (!actual) return { error: "Orden inválida." };
  if (actual.estado !== "asignado")
    return { error: "Esta orden ya no está asignada; recarga la página para ver su estado actual." };

  const esEntrega = actual.tipo === "entrega";

  const guiasPrevias: string[] = actual.guias_urls?.length
    ? actual.guias_urls
    : actual.guia_url
      ? [actual.guia_url]
      : [];
  // Una sola evidencia obligatoria por tipo, no dos: en una Cotización manda
  // la guía de remisión (el material queda opcional, para cuando aporte algo);
  // en un Pedido no hay guía que emitir, así que la foto del material es la
  // única constancia del recojo y ahí sí se exige.
  if (esEntrega && guias.length === 0 && guiasPrevias.length === 0)
    return { error: "Toma al menos una foto de la guía antes de confirmar." };
  if (!esEntrega && material.length === 0)
    return { error: "Toma al menos una foto del material antes de confirmar." };
  if (!esEntrega && recojoParcial && !notaFaltante)
    return { error: "Cuéntanos qué faltó recoger." };

  let guiaUrls = guiasPrevias;
  if (esEntrega && guias.length > 0) {
    const { urls: nuevas, error: upErr } = await uploadMany(supabase, "guias", orderId, guias);
    if (upErr) return { error: "No se pudo subir la foto de la guía: " + upErr };
    guiaUrls = [...guiasPrevias, ...nuevas];
  }

  const { urls: materialUrls, error: matErr } = await uploadMany(
    supabase,
    "guias",
    `${orderId}/material`,
    material
  );
  if (matErr) return { error: "No se pudo subir la foto del material: " + matErr };

  const marcaParcial = !esEntrega && recojoParcial;

  // Lo que faltó se guarda en observaciones para que almacén lo lea en la
  // ficha antes de contar. A propósito NO se crea acá el remanente ni se
  // marca `entrega_parcial`: eso es el cierre, y lo hace almacén con
  // completeOrder. Si se creara en los dos lados, una orden que el
  // repartidor reporta parcial y almacén cierra parcial terminaría con dos
  // remanentes por el mismo faltante.
  const observacionFinal = [observaciones, marcaParcial ? `Faltó recoger: ${notaFaltante}` : ""]
    .filter(Boolean)
    .join(" · ");

  const { data: updated, error } = await supabase
    .from("orders")
    .update({
      material_urls: materialUrls,
      ...(esEntrega ? { guia_url: guiaUrls[0] ?? null, guias_urls: guiaUrls } : {}),
      ...(esEntrega && numeroGuiaInput ? { numero_guia: numeroGuiaInput } : {}),
      estado: "en_transito",
      en_transito_at: new Date().toISOString(),
      ...(observacionFinal ? { observaciones: observacionFinal } : {}),
    })
    .eq("id", orderId)
    .select("numero_pedido, cliente")
    .single();
  if (error) return { error: error.message };

  await registrarEvento(
    supabase,
    orderId,
    marcaParcial ? "recogida_parcial" : "recogida",
    marcaParcial ? notaFaltante : null
  );
  if (observaciones) await registrarEvento(supabase, orderId, "observacion", observaciones);

  const almacenIds = await userIdsByRole("almacen");
  await notify(almacenIds, {
    tipo: "orden_en_transito",
    titulo: marcaParcial
      ? "Material recogido PARCIAL — falta verificar"
      : "Material recogido — falta verificar",
    mensaje: `#${updated.numero_pedido}${updated.cliente ? " · " + updated.cliente : ""} — ${
      marcaParcial ? `faltó: ${notaFaltante}` : "cuenten los ítems para cerrarla."
    }`,
    orderId,
  });

  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath("/ordenes");
  redirect("/ordenes");
}

/**
 * El repartidor fue al proveedor (Pedido) o donde el cliente (Cotización) y
 * no pudo completar su parte. La orden vuelve a "pendiente" y queda libre
 * para reasignar — no es un estado del flujo, es un intento que falló. Se
 * guarda el motivo y se suma un intento para que se vea qué proveedor o
 * cliente está fallando repetido. Misma lógica para los dos tipos, solo
 * cambia el vocabulario (ver NoRecogidoForm).
 */
export async function marcarNoRecogido(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  await requireRole(["repartidor", "almacen", "admin"]);

  const orderId = String(formData.get("order_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!orderId) return { error: "Orden inválida." };
  if (!motivo) return { error: "Cuéntanos qué pasó." };

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("orders")
    .select("numero_pedido, cliente, tipo, no_recogido_intentos")
    .eq("id", orderId)
    .single();
  if (!actual) return { error: "Orden inválida." };

  const intentos = (actual.no_recogido_intentos ?? 0) + 1;
  const esEntrega = actual.tipo === "entrega";

  const { error } = await supabase
    .from("orders")
    .update({
      estado: "pendiente",
      assigned_to: null,
      assigned_at: null,
      no_recogido_intentos: intentos,
      no_recogido_motivo: motivo,
      no_recogido_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) return { error: error.message };

  await registrarEvento(supabase, orderId, esEntrega ? "no_entregado" : "no_recogida", motivo);

  const almacenIds = await userIdsByRole("almacen");
  await notify(almacenIds, {
    tipo: "orden_pendiente",
    titulo: `No se pudo ${esEntrega ? "entregar" : "recoger"}${intentos > 1 ? ` (intento ${intentos})` : ""}`,
    mensaje: `#${actual.numero_pedido}${
      actual.cliente ? " · " + actual.cliente : ""
    } — ${motivo}`,
    orderId,
  });

  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath("/ordenes");
  redirect("/ordenes");
}

/** Campos que Ventas puede corregir después de crear la orden. El número
 *  queda fuera a propósito: es la identidad de la orden, tiene índice único y
 *  el trigger de la base lo bloquea aunque alguien llame a la API directo. */
const CAMPOS_EDITABLES = [
  "cliente",
  "proyecto",
  "nota",
  "proveedor",
  "numero_pedido_compra",
] as const;

/**
 * Ventas corrige los datos de una orden. Cualquier vendedor puede hacerlo, no
 * solo quien la creó (Ventas2 arregla lo que cargó Ventas1), pero solo
 * mientras siga Pendiente: una vez que almacén la tomó, los datos ya se usaron
 * para despachar.
 *
 * Almacén NO entra acá a propósito: estos son datos de la venta (cliente,
 * proyecto, proveedor de compra), no del despacho. Si almacén ve algo mal, lo
 * corrige Ventas — así el dato tiene un solo dueño y el historial no mezcla
 * quién decide qué.
 *
 * Cada campo que realmente cambió queda en el historial con su valor anterior.
 */
export async function editarOrden(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  const { userId } = await requireRole(["vendedor", "admin"]);

  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Orden inválida." };

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("orders")
    .select("id, estado, tipo, numero_pedido, cliente, proyecto, nota, proveedor, numero_pedido_compra, created_by")
    .eq("id", orderId)
    .single();
  if (!actual) return { error: "Orden inválida." };
  if (actual.estado !== "pendiente")
    return {
      error: "Esta orden ya está en camino; para corregirla ahora habla con almacén.",
    };

  const cambios: Record<string, string | null> = {};
  const eventos: Array<{
    tipo: "editada";
    campo: string;
    valorAntes: string | null;
    valorDespues: string | null;
  }> = [];

  for (const campo of CAMPOS_EDITABLES) {
    // Un campo ausente en el formulario no se toca (el bloque de compra solo
    // se envía cuando la orden es de tipo Cliente).
    if (!formData.has(campo)) continue;
    const nuevo = String(formData.get(campo) ?? "").trim() || null;
    const anterior = (actual as Record<string, unknown>)[campo] as string | null;
    if (nuevo !== anterior) {
      cambios[campo] = nuevo;
      eventos.push({ tipo: "editada", campo, valorAntes: anterior, valorDespues: nuevo });
    }
  }

  if (eventos.length === 0) return { ok: true };

  // `.select().single()` a propósito: si RLS descarta la fila, PostgREST
  // devuelve cero filas SIN error, y la acción reportaría éxito de un cambio
  // que nunca ocurrió (y el historial registraría una mentira).
  const { data: guardada, error } = await supabase
    .from("orders")
    .update(cambios)
    .eq("id", orderId)
    .select("id")
    .single();
  if (error || !guardada) {
    return { error: error?.message ?? "No tienes permiso para editar esta orden." };
  }

  await registrarEventos(supabase, orderId, eventos);

  // Avisa a quien la creó (si no es quien edita), a almacén y a los admin:
  // almacén puede estar por despacharla con el dato viejo.
  const [almacenIds, adminIds] = await Promise.all([
    userIdsByRole("almacen"),
    userIdsByRole("admin"),
  ]);
  const destinatarios = [
    ...(actual.created_by && actual.created_by !== userId ? [actual.created_by] : []),
    ...almacenIds,
    ...adminIds,
  ].filter((id) => id !== userId);

  const resumen = eventos.map((e) => CAMPO_LABEL[e.campo] ?? e.campo).join(", ");
  await notify(destinatarios, {
    tipo: "orden_editada",
    titulo: "Orden modificada",
    mensaje: `#${actual.numero_pedido} — se corrigió: ${resumen}.`,
    orderId,
  });

  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath("/ordenes");
  return { ok: true };
}

/**
 * Almacén parte una orden en varios envíos ANTES de despacharla: una cotización
 * de 10 ítems puede salir en varias guías de remisión porque no hay stock de
 * todo o no entra en un viaje. Crea la orden del resto (sufijo -E) y deja la
 * original siguiendo su curso normal — el repartidor entrega lo que le dan y la
 * cierra como Completa, sin enterarse de nada.
 *
 * Es distinto del remanente (-R), que nace de un error detectado en el punto de
 * entrega. Separarlos permite medir cuántas veces se falla de verdad.
 */
export async function dividirEnvio(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  await requireRole(["almacen", "admin"]);

  const orderId = String(formData.get("order_id") ?? "");
  const nota = String(formData.get("nota_pendiente") ?? "").trim();

  if (!orderId) return { error: "Orden inválida." };
  if (!nota) return { error: "Escribe qué queda pendiente para el siguiente envío." };

  const supabase = await createClient();

  const { data: padre } = await supabase
    .from("orders")
    .select("id, numero_pedido, cliente, proyecto, proveedor, numero_pedido_compra, tipo, modalidad, courier_tracking, imagen_url, imagenes_urls, created_by, estado")
    .eq("id", orderId)
    .single();
  if (!padre) return { error: "Orden inválida." };
  if (padre.estado === "completado")
    return { error: "Esta orden ya se cerró; no se puede dividir." };

  const hija = await crearOrdenHija(supabase, padre, "envio", nota);
  if ("error" in hija) return { error: hija.error };

  await registrarEvento(supabase, orderId, "dividida", `${nota} → #${hija.numero}`);
  await registrarEvento(supabase, hija.id, "creada", `Resto de #${padre.numero_pedido}`);

  const almacenIds = await userIdsByRole("almacen");
  await notify([...almacenIds, ...(padre.created_by ? [padre.created_by] : [])], {
    tipo: "orden_pendiente",
    titulo: "Envío dividido",
    mensaje: `#${padre.numero_pedido} se despacha en partes — queda pendiente #${hija.numero}.`,
    orderId: hija.id,
  });

  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath(`/ordenes/${hija.id}`);
  revalidatePath("/ordenes");
  redirect(`/ordenes/${orderId}`);
}

/** Sube una o más fotos de la guía/comprobante y marca la orden como
 *  completada (total o parcial). Exclusivo de Almacén/Admin — el repartidor
 *  nunca cierra una orden, su trabajo termina en "En Tránsito" (ver
 *  marcarEnTransito). Si la orden ya venía "En Tránsito", la guía/material se
 *  subió al confirmar, así que acá esas fotos son opcionales (quien cuenta
 *  puede sumar otra si quiere, no reemplaza la anterior). */
export async function completeOrder(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  await requireRole(["almacen", "admin"]);

  const orderId = String(formData.get("order_id") ?? "");
  const parcial = String(formData.get("entrega_parcial") ?? "") === "true";
  const notaFaltante = String(formData.get("nota_faltante") ?? "").trim();
  const observaciones = String(formData.get("observaciones") ?? "").trim();
  const numeroGuiaInput = String(formData.get("numero_guia") ?? "").trim();
  const guias = formData.getAll("guias").filter((f): f is File => f instanceof File && f.size > 0);
  const material = formData.getAll("material").filter((f): f is File => f instanceof File && f.size > 0);

  if (!orderId) return { error: "Orden inválida." };
  if (parcial && !notaFaltante) return { error: "Cuéntanos qué falta completar." };

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("orders")
    .select("id, estado, tipo, guias_urls, guia_url, numero_guia, material_urls, numero_pedido, cliente, proyecto, proveedor, numero_pedido_compra, modalidad, courier_tracking, imagen_url, imagenes_urls, created_by")
    .eq("id", orderId)
    .single();
  if (!actual) return { error: "Orden inválida." };
  if (actual.estado === "completado")
    return { error: "Esta orden ya fue cerrada por otra persona." };

  // La guía de remisión la emite SkyHigh y solo aplica a una entrega a
  // cliente — la del proveedor nunca se registra, así que un Pedido no la
  // pide en ningún paso. Ahí la constancia es la foto del material.
  const esRecojo = actual.tipo === "recojo";

  const guiasPrevias: string[] = actual.guias_urls?.length
    ? actual.guias_urls
    : actual.guia_url
      ? [actual.guia_url]
      : [];

  // El número de guía ya NO es obligatorio para cerrar: el repartidor puede
  // confirmar sin escribirlo, y acá Almacén lo completa o corrige si lo
  // tiene — pero si sigue vacío, no bloquea el cierre.
  let numeroGuia: string | null = null;
  if (!esRecojo) {
    if (guias.length === 0 && guiasPrevias.length === 0)
      return { error: "Toma al menos una foto de la guía antes de confirmar." };
    numeroGuia = numeroGuiaInput || actual.numero_guia;
  }

  const materialPrevio = actual.material_urls ?? [];

  let urls = guiasPrevias;
  if (!esRecojo && guias.length > 0) {
    const { urls: nuevas, error: upErr } = await uploadMany(supabase, "guias", orderId, guias);
    if (upErr) return { error: "No se pudo subir la foto: " + upErr };
    urls = [...guiasPrevias, ...nuevas];
  }

  let materialUrls = materialPrevio;
  if (material.length > 0) {
    const { urls: nuevasMaterial, error: matErr } = await uploadMany(
      supabase,
      "guias",
      `${orderId}/material`,
      material
    );
    if (matErr) return { error: "No se pudo subir la foto del material: " + matErr };
    materialUrls = [...materialUrls, ...nuevasMaterial];
  }

  // Backorder: si quedó parcial, se crea un pedido nuevo solo por lo que falta
  // (mismo patrón que usa Odoo) — el original queda como registro histórico de
  // lo que sí se entregó, y el remanente arranca de "pendiente" para que
  // almacén lo asigne.
  //
  // Se crea ANTES de cerrar el padre a propósito: si el remanente falla (número
  // ocupado, permisos), se aborta sin haber cerrado nada. Al revés, la orden
  // quedaba cerrada como parcial y el remanente se perdía en silencio.
  // Backorder: si quedó parcial, se crea un pedido nuevo solo por lo que falta
  // (mismo patrón que usa Odoo) — el original queda como registro histórico de
  // lo que sí se entregó, y el remanente arranca de "pendiente" para que
  // almacén lo asigne.
  //
  // Se crea ANTES de cerrar el padre a propósito: si el remanente falla (número
  // ocupado, permisos), se aborta sin haber cerrado nada. Al revés, la orden
  // quedaba cerrada como parcial y el remanente se perdía en silencio.
  let backorderId: string | null = null;
  if (parcial) {
    const hija = await crearOrdenHija(supabase, actual, "remanente", notaFaltante);
    if ("error" in hija) {
      console.error("No se pudo crear el remanente:", hija.error, { orderId });
      return { error: `No se pudo crear el pedido con lo que falta: ${hija.error}` };
    }
    backorderId = hija.id;
  }

  const { error } = await supabase
    .from("orders")
    .update({
      guia_url: urls[0] ?? null,
      guias_urls: urls,
      numero_guia: numeroGuia,
      material_urls: materialUrls,
      entrega_parcial: parcial,
      estado: "completado",
      completed_at: new Date().toISOString(),
      ...(observaciones ? { observaciones } : {}),
    })
    .eq("id", orderId);
  if (error) return { error: error.message };

  const updated = actual;

  await registrarEvento(
    supabase,
    orderId,
    parcial ? "parcial" : "completada",
    parcial ? notaFaltante : null
  );
  if (observaciones) await registrarEvento(supabase, orderId, "observacion", observaciones);

  if (updated.created_by) {
    await notify([updated.created_by], {
      tipo: parcial ? "orden_parcial" : "orden_completada",
      titulo: parcial ? "Orden completada parcialmente" : "Orden completada",
      mensaje: `#${updated.numero_pedido}${updated.cliente ? " · " + updated.cliente : ""}${
        parcial ? " — falta terminar el resto." : ""
      }`,
      orderId,
    });
  }

  if (backorderId) {
    const almacenIds = await userIdsByRole("almacen");
    await notify(almacenIds, {
      tipo: "orden_pendiente",
      titulo: "Pedido pendiente por entrega parcial",
      mensaje: `#${updated.numero_pedido} quedó parcial — falta asignar el remanente.`,
      orderId: backorderId,
    });
  }

  revalidatePath(`/ordenes/${orderId}`);
  if (backorderId) revalidatePath(`/ordenes/${backorderId}`);
  revalidatePath("/ordenes");
  redirect("/ordenes");
}

/**
 * Elimina una orden. Solo Admin: Ventas corrige datos (ver editarOrden) pero
 * no borra el registro — el resto de roles (almacén, repartidor) trabajan
 * sobre la orden pero tampoco son dueños del registro. Bloqueada también si
 * tiene hijas (remanente o envío dividido): borrarla dejaría esos enlaces
 * cruzados apuntando a un id inexistente y el hilo de la familia se pierde.
 */
/**
 * Anula una orden porque el cliente canceló la OC. NO la borra: la orden se
 * queda como registro con su historial intacto, solo sale de circulación
 * (pasa al estado "anulado", que ninguna consulta del tablero incluye).
 *
 * Es la alternativa a `deleteOrder` para el caso normal de negocio — eliminar
 * queda para el error de carga, y sigue siendo exclusivo de Admin.
 *
 * La puede anular Ventas (es quien habla con el cliente y se entera de la
 * cancelación), Almacén y Admin. No se permite sobre una orden ya cerrada:
 * si el material salió y se entregó, cancelarla ya no describe la realidad —
 * eso se corrige por otra vía.
 */
export async function anularOrden(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const { userId } = await requireRole(["admin", "vendedor", "almacen"]);

  const orderId = String(formData.get("order_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!orderId) return { error: "Orden inválida." };
  if (!motivo) return { error: "Cuéntanos por qué se anula la orden." };

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("orders")
    .select("estado, numero_pedido, cliente, created_by")
    .eq("id", orderId)
    .single();
  if (!actual) return { error: "Orden inválida." };

  if (actual.estado === "anulado") {
    return { error: "Esta orden ya está anulada." };
  }
  if (actual.estado === "completado") {
    return { error: "Esta orden ya se completó; no se puede anular." };
  }

  // `.select()` para no dar por buena una anulación que RLS descartó en
  // silencio (PostgREST devuelve cero filas sin error).
  const { data: anulada, error } = await supabase
    .from("orders")
    .update({
      estado: "anulado",
      anulada_motivo: motivo,
      anulada_at: new Date().toISOString(),
      anulada_por: userId,
    })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!anulada) return { error: "No tienes permiso para anular esta orden." };

  await registrarEvento(supabase, orderId, "anulada", motivo);

  // Se avisa a quien la creó (si no fue él mismo quien anuló) para que no
  // siga esperando una orden que ya no va a moverse.
  if (actual.created_by && actual.created_by !== userId) {
    await notify([actual.created_by], {
      tipo: "orden_completada",
      titulo: "Orden anulada",
      mensaje: `#${actual.numero_pedido}${actual.cliente ? " · " + actual.cliente : ""} — ${motivo}`,
      orderId,
    });
  }

  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath("/ordenes");
  return {};
}

export async function deleteOrder(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireRole(["admin"]);
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Orden inválida." };

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("orders")
    .select("estado")
    .eq("id", orderId)
    .single();
  if (!actual) return { error: "Orden inválida." };

  const { data: hijos } = await supabase
    .from("orders")
    .select("id")
    .eq("parent_order_id", orderId)
    .limit(1);
  if (hijos && hijos.length > 0) {
    return {
      error: "Esta orden tiene una división (remanente o envío) enlazada; no se puede eliminar.",
    };
  }

  // `.select()` para detectar el caso en que RLS descarte la fila: PostgREST
  // devuelve cero filas SIN error, y la acción reportaría un borrado que
  // nunca ocurrió.
  const { data: borrada, error } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!borrada) return { error: "No tienes permiso para eliminar esta orden." };

  revalidatePath("/ordenes");
  redirect("/ordenes");
}

/**
 * Agrega uno o más PDF/imágenes a una orden ya creada. Es la contraparte de
 * `eliminarAdjunto`: hasta ahora se podía quitar el archivo equivocado pero no
 * subir el correcto, y había que borrar la orden y rehacerla.
 *
 * Mismos permisos que quitar (ver eliminarAdjunto): Ventas mientras la orden
 * siga Pendiente, Almacén sobre las que él mismo creó, y Admin siempre.
 * Los archivos nuevos se agregan al final, sin tocar los que ya estaban.
 */
export async function agregarAdjuntos(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  const { userId, profile } = await requireRole(["admin", "vendedor", "almacen"]);

  const orderId = String(formData.get("order_id") ?? "");
  const archivos = formData
    .getAll("imagenes")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!orderId) return { error: "Orden inválida." };
  if (archivos.length === 0) return { error: "Elige al menos un archivo." };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("imagenes_urls, estado, created_by")
    .eq("id", orderId)
    .single();
  if (!order) return { error: "Orden inválida." };

  if (profile.role === "vendedor" && order.estado !== "pendiente") {
    return { error: "Esta orden ya está en curso; pide a un administrador que la corrija." };
  }
  if (profile.role === "almacen" && order.created_by !== userId) {
    return { error: "Solo puedes cambiar los archivos de las órdenes que tú creaste." };
  }

  const { urls, error: upErr } = await uploadMany(supabase, "ordenes", userId, archivos);
  if (upErr) return { error: "No se pudo subir el archivo: " + upErr };

  const actuales: string[] = order.imagenes_urls ?? [];
  const todas = [...actuales, ...urls];

  const { error } = await supabase
    .from("orders")
    .update({ imagenes_urls: todas, imagen_url: todas[0] ?? null })
    .eq("id", orderId);
  if (error) return { error: error.message };

  await registrarEvento(supabase, orderId, "adjunto_agregado");

  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath("/ordenes");
  return {};
}

/**
 * Quita un PDF/imagen adjunto a la orden (no la orden completa — eso es
 * `deleteOrder`).
 *
 * Solo Ventas y Admin: el documento de la cotización/pedido lo carga Ventas
 * al crear la orden y es la referencia con la que todos los demás trabajan.
 * Almacén y el repartidor lo necesitan para despachar, no para editarlo — y
 * teniendo la "×" a mano era cuestión de tiempo que alguien la tocara sin
 * querer. Ventas, además, solo mientras la orden siga Pendiente (mismo
 * límite que para corregir los datos; la base también lo exige, ver
 * 30_vendedor_adjuntos.sql).
 */
export async function eliminarAdjunto(formData: FormData): Promise<void> {
  const { userId, profile } = await requireRole(["admin", "vendedor", "almacen"]);

  const orderId = String(formData.get("order_id") ?? "");
  const url = String(formData.get("url") ?? "");
  if (!orderId || !url) return;

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("imagen_url, imagenes_urls, estado, created_by")
    .eq("id", orderId)
    .single();
  if (!order) return;
  if (profile.role === "vendedor" && order.estado !== "pendiente") return;
  // Almacén solo sobre las órdenes que él mismo creó (ver agregarAdjuntos).
  if (profile.role === "almacen" && order.created_by !== userId) return;

  const restantes = (order.imagenes_urls ?? []).filter((u: string) => u !== url);
  await supabase
    .from("orders")
    .update({ imagenes_urls: restantes, imagen_url: restantes[0] ?? null })
    .eq("id", orderId);

  // Borrar el archivo real del storage es "mejor esfuerzo": si falla (ya
  // no existe, o la URL no calza con el patrón esperado) no bloqueamos
  // la operación — lo importante es que ya no aparezca en la orden.
  //
  // crearOrdenHija() copia imagen_url/imagenes_urls del padre a la hija, así
  // que la misma URL de storage puede estar referenciada por más de una
  // orden. Antes de borrar el archivo físico hay que confirmar que ninguna
  // OTRA orden la sigue usando — si no, una división borraría en cascada la
  // foto que el padre (o una hija hermana) todavía necesita mostrar.
  const marker = "/object/public/ordenes/";
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    const [{ data: porUnica }, { data: porArreglo }] = await Promise.all([
      supabase.from("orders").select("id").neq("id", orderId).eq("imagen_url", url).limit(1),
      supabase.from("orders").select("id").neq("id", orderId).contains("imagenes_urls", [url]).limit(1),
    ]);
    const compartida = (porUnica?.length ?? 0) > 0 || (porArreglo?.length ?? 0) > 0;
    if (!compartida) {
      const path = url.slice(idx + marker.length).split("?")[0];
      await supabase.storage.from("ordenes").remove([path]);
    }
  }

  await registrarEvento(supabase, orderId, "adjunto_eliminado");

  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath("/ordenes");
}
