import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, GitBranch } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fechaHoraCorta } from "@/lib/fecha";
import { ymdLima } from "@/lib/reportes";
import { secuenciaRepartidor, secuenciaTablero } from "@/lib/tablero";
import { createClient } from "@/lib/supabase/server";
import { ModalidadBadge, StatusBadge, TypeBadge } from "@/components/badges";
import { ImageGallery } from "@/components/image-gallery";
import { EliminarOrdenButton } from "./eliminar-orden";
import { AnularOrdenForm } from "./anular-orden";
import { ModalidadForm } from "./modalidad-form";
import { AsignarForm } from "./asignar-form";
import CompletarForm, { ConfirmarTransitoForm } from "./completar";
import { DividirEnvioForm } from "./dividir-envio";
import { EditarOrdenForm } from "./editar-form";
import { AgregarAdjuntosForm } from "./agregar-adjuntos";
import { HistorialPanel } from "./historial-panel";
import type { OrderEvent } from "@/lib/historial";
import { modalidadLabel, type OrderWithNames, type Profile } from "@/lib/types";

const SELECT =
  "*, creador:profiles!orders_created_by_fkey(full_name), repartidor:profiles!orders_assigned_to_fkey(full_name)";

const fmt = fechaHoraCorta;

export default async function OrdenDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, profile } = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase.from("orders").select(SELECT).eq("id", id).single();
  if (!data) notFound();
  const order = data as unknown as OrderWithNames;

  // Compatibilidad: si una orden vieja no tiene el arreglo poblado, cae al campo único.
  const imagenesOrden = order.imagenes_urls?.length
    ? order.imagenes_urls
    : order.imagen_url
      ? [order.imagen_url]
      : [];
  const imagenesGuia = order.guias_urls?.length
    ? order.guias_urls
    : order.guia_url
      ? [order.guia_url]
      : [];
  const imagenesMaterial = order.material_urls ?? [];

  const canAssign = profile.role === "admin" || profile.role === "almacen";
  const isMine = order.assigned_to === userId;
  const isRepartidor = profile.role === "repartidor";
  const isAlmacen = profile.role === "almacen";
  // Quitar el PDF/foto de la orden es de Ventas y Admin, igual que corregir
  // los datos: el documento lo carga Ventas y el resto solo lo consulta para
  // despachar. Con la "×" a la vista de todos era cuestión de tiempo que
  // alguien borrara la cotización sin querer.
  // Almacén se suma solo para las órdenes que él mismo creó (casos especiales
  // tipo "mandar a bordar"): son suyas de punta a punta, no de Ventas.
  const puedeEditarAdjuntos =
    profile.role === "admin" ||
    (profile.role === "vendedor" && order.estado === "pendiente") ||
    (profile.role === "almacen" && order.created_by === userId);
  // Anulada: el cliente canceló la OC. La orden queda como registro, así que
  // no admite ninguna acción del flujo — solo se consulta.
  const estaAnulada = order.estado === "anulado";
  // Cerrar la orden (y decidir completo/parcial) es exclusivo de Almacén y
  // Admin — el repartidor nunca cierra, su trabajo termina en "En Tránsito".
  const canComplete =
    order.estado !== "completado" && !estaAnulada && (profile.role === "admin" || isAlmacen);

  // Una orden de modalidad Reparto (Pedido o Cotización) que todavía tiene
  // que confirmar el repartidor: sube evidencia y pasa a "En Tránsito", sin
  // decir si llegó completo (eso lo decide Almacén al cerrar). Oficina/
  // courier no pasan por acá — Almacén/admin las cierra directo desde
  // "asignado", porque nunca hay nadie recogiendo o entregando en la calle.
  const puedeConfirmarTransito =
    order.modalidad === "reparto" && order.estado === "asignado" && isRepartidor && isMine;
  // Ya se confirmó y falta que Almacén cuente y cierre.
  const estaEnTransito = order.estado === "en_transito";
  // Almacén puede partir la orden en varios envíos mientras no esté cerrada.
  const puedeDividir = canAssign && order.estado !== "completado" && !estaAnulada;
  // Anular es la salida para "el cliente canceló la OC": conserva la orden y
  // su historial, a diferencia de eliminar (solo Admin, para el error de
  // carga). No aplica sobre una orden ya cerrada ni sobre una ya anulada.
  const puedeAnular =
    !estaAnulada &&
    order.estado !== "completado" &&
    (profile.role === "admin" || profile.role === "vendedor" || isAlmacen);

  // Backorder: si esta orden viene de una parcial, o si generó una al
  // quedar parcial, se muestra el enlace cruzado para no perder el hilo.
  const [{ data: padre }, { data: hijos }] = await Promise.all([
    order.parent_order_id
      ? supabase.from("orders").select("id, numero_pedido, division_tipo").eq("id", order.parent_order_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("orders")
      .select("id, numero_pedido, estado, division_tipo")
      .eq("parent_order_id", order.id),
  ]);

  const esEnvioDividido =
    order.division_tipo === "envio" || (hijos ?? []).some((h) => h.division_tipo === "envio");

  // Historial completo de la orden, visible para todos los roles.
  const { data: eventosData } = await supabase
    .from("order_events")
    .select("id, tipo, campo, valor_antes, valor_despues, nota, created_at, autor:profiles!order_events_user_id_fkey(full_name)")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });
  const eventos = (eventosData ?? []) as unknown as OrderEvent[];

  // Navegación anterior/siguiente, para recorrer las órdenes sin volver al
  // tablero. Sigue EL MISMO orden en que se leen en pantalla —sección, columna
  // y posición dentro de la columna— usando la secuencia compartida de
  // lib/tablero.ts. Antes iba por fecha de subida y "Siguiente" saltaba a una
  // orden que estaba en otra columna del tablero.
  //
  // Se incluyen las completadas de hoy porque el tablero también las muestra
  // (es su rango por defecto); si esta orden no está en la vista, simplemente
  // no hay vecinos y los botones no aparecen.
  let navQuery = supabase
    .from("orders")
    .select(SELECT)
    .or(
      `estado.in.(pendiente,asignado,en_transito),and(estado.eq.completado,completed_at.gte.${ymdLima(new Date())}T00:00:00-05:00)`
    );
  if (isRepartidor) navQuery = navQuery.eq("assigned_to", userId);
  const { data: navData } = await navQuery;
  const navOrders = (navData ?? []) as unknown as OrderWithNames[];

  // Los repartidores hacen falta para dos cosas: armar el orden de las
  // columnas "Asignadas" (la navegación) y llenar el selector de asignar.
  // Se consultan una sola vez para no repetir el viaje a la base.
  const repartidores = isRepartidor
    ? []
    : (((
        await supabase
          .from("profiles")
          .select("*")
          .eq("role", "repartidor")
          .eq("activo", true)
          .order("full_name")
      ).data ?? []) as Profile[]);

  const secuencia = isRepartidor
    ? secuenciaRepartidor(navOrders)
    : secuenciaTablero(navOrders, repartidores);

  const navIdx = secuencia.findIndex((o) => o.id === order.id);
  const prevId = navIdx > 0 ? secuencia[navIdx - 1].id : null;
  const nextId =
    navIdx >= 0 && navIdx < secuencia.length - 1 ? secuencia[navIdx + 1].id : null;

  // Ventas corrige datos solo mientras nadie la haya tomado: después ya se
  // usaron para despachar. Cualquier vendedor puede, no solo quien la creó.
  // Almacén queda fuera: estos son datos de la venta, no del despacho — si ve
  // algo mal, lo corrige Ventas (ver editarOrden en actions.ts).
  const puedeEditar =
    order.estado === "pendiente" &&
    (profile.role === "vendedor" || profile.role === "admin");

  // Eliminar: solo Admin. Ventas puede corregir datos (puedeEditar) pero no
  // borrar la orden — ver deleteOrder en actions.ts y la policy orders_delete.
  const puedeEliminar = profile.role === "admin";

  // Mismos roles que el endpoint /api/export-guias, para no ofrecer un botón
  // que después responde 403.
  const puedeDescargarGuias =
    profile.role === "admin" || isAlmacen || profile.role === "facturacion";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/ordenes"
          className="inline-flex items-center gap-1 py-1 text-sm font-medium text-gray-500 hover:text-brand"
        >
          ‹ Volver a órdenes
        </Link>

        {/* Recorrer las órdenes activas sin volver al tablero. Si no hay
            vecino en un sentido, el botón queda deshabilitado (gris). */}
        {(prevId || nextId) && (
          <div className="flex items-center gap-2">
            {prevId ? (
              <Link
                href={`/ordenes/${prevId}`}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:border-brand hover:text-brand"
              >
                ‹ Anterior
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-300">
                ‹ Anterior
              </span>
            )}
            {nextId ? (
              <Link
                href={`/ordenes/${nextId}`}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:border-brand hover:text-brand"
              >
                Siguiente ›
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-300">
                Siguiente ›
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-900">#{order.numero_pedido}</h1>
        <TypeBadge tipo={order.tipo} />
        <ModalidadBadge modalidad={order.modalidad} />
        <StatusBadge estado={order.estado} parcial={order.entrega_parcial} />
        <div className="ml-auto">
          <HistorialPanel eventos={eventos} />
        </div>
      </div>

      {/* Enlace cruzado con la familia de la orden. El texto depende de POR QUÉ
          existe la relación: un envío dividido es un despacho planificado y no
          debe leerse como si algo hubiera fallado. */}
      {(padre || (hijos && hijos.length > 0)) && (
        <div
          className={`space-y-1.5 rounded-xl border p-3 text-sm ${
            esEnvioDividido ? "border-sky-200 bg-sky-50" : "border-orange-200 bg-orange-50"
          }`}
        >
          {padre && (
            <Link
              href={`/ordenes/${padre.id}`}
              className={`flex items-center gap-1.5 font-medium hover:underline ${
                order.division_tipo === "envio" ? "text-sky-800" : "text-orange-800"
              }`}
            >
              <GitBranch className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              {order.division_tipo === "envio"
                ? `Es el resto pendiente de la orden #${padre.numero_pedido} (se despacha en partes)`
                : `Es el remanente de la orden #${padre.numero_pedido} (quedó parcial)`}
            </Link>
          )}
          {hijos?.map((h) => (
            <Link
              key={h.id}
              href={`/ordenes/${h.id}`}
              className={`flex items-center gap-1.5 font-medium hover:underline ${
                h.division_tipo === "envio" ? "text-sky-800" : "text-orange-800"
              }`}
            >
              <GitBranch className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              {h.division_tipo === "envio"
                ? `Se despacha aparte: #${h.numero_pedido} (${h.estado})`
                : `Falta completar: pedido #${h.numero_pedido} (${h.estado})`}
            </Link>
          ))}
        </div>
      )}

      {/* Imágenes de la orden */}
      {imagenesOrden.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-gray-500">
            Orden {imagenesOrden.length > 1 && `(${imagenesOrden.length} imágenes)`}
          </h2>
          <ImageGallery
            urls={imagenesOrden}
            alt="Imagen de la orden"
            orderId={puedeEditarAdjuntos ? order.id : undefined}
            descargaPrefijo={`orden-${order.numero_pedido}`}
          />
        </div>
      )}

      {/* Volver a subir el PDF/imagen: la contraparte de la "×". Se muestra
          también cuando no queda ninguno, que es justo cuando más hace falta. */}
      {puedeEditarAdjuntos && <AgregarAdjuntosForm orderId={order.id} />}

      {/* Intento(s) fallido(s) de recojo: almacén necesita verlo para
          coordinar con el proveedor antes de volver a asignarla. */}
      {/* Anulada: lo primero que se tiene que leer al abrir la orden, para que
          nadie siga trabajando sobre algo que el cliente ya canceló. */}
      {estaAnulada && (
        <div className="rounded-xl border border-gray-300 bg-gray-100 p-3 text-sm">
          <p className="font-semibold text-gray-800">Orden anulada</p>
          {order.anulada_motivo && (
            <p className="mt-0.5 text-gray-700">{order.anulada_motivo}</p>
          )}
          {order.anulada_at && (
            <p className="mt-0.5 text-xs text-gray-500">Anulada el {fmt(order.anulada_at)}</p>
          )}
        </div>
      )}

      {order.no_recogido_intentos > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
          <p className="font-semibold text-red-800">
            No se pudo recoger
            {order.no_recogido_intentos > 1 && ` · ${order.no_recogido_intentos} intentos`}
          </p>
          {order.no_recogido_motivo && (
            <p className="mt-0.5 text-red-700">{order.no_recogido_motivo}</p>
          )}
          {order.no_recogido_at && (
            <p className="mt-0.5 text-xs text-red-600">Último intento: {fmt(order.no_recogido_at)}</p>
          )}
        </div>
      )}

      {/* Datos */}
      <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <div className="col-span-2 min-w-0">
          <dt className="text-gray-400">{order.tipo === "recojo" ? "Proveedor" : "Cliente"}</dt>
          <dd className="break-words font-medium text-gray-800">{order.cliente || "—"}</dd>
        </div>
        {order.proyecto && (
          <div className="col-span-2 min-w-0">
            <dt className="text-gray-400">Proyecto</dt>
            <dd className="break-words font-medium text-gray-800">{order.proyecto}</dd>
          </div>
        )}
        <div className="min-w-0">
          <dt className="text-gray-400">Creada por</dt>
          <dd className="break-words font-medium text-gray-800">{order.creador?.full_name ?? "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-400">Repartidor</dt>
          <dd className="break-words font-medium text-gray-800">{order.repartidor?.full_name ?? "Sin asignar"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-400">Creada</dt>
          <dd className="break-words font-medium text-gray-800">{fmt(order.created_at)}</dd>
        </div>
        {order.en_transito_at && (
          <div className="min-w-0">
            <dt className="text-gray-400">{order.tipo === "recojo" ? "Recogida" : "Confirmada"}</dt>
            <dd className="break-words font-medium text-gray-800">{fmt(order.en_transito_at)}</dd>
          </div>
        )}
        <div className="min-w-0">
          <dt className="text-gray-400">Completada</dt>
          <dd className="break-words font-medium text-gray-800">{fmt(order.completed_at) ?? "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-400">Modalidad</dt>
          <dd className="break-words font-medium text-gray-800">
            {modalidadLabel(order.modalidad, order.tipo)}
          </dd>
        </div>
        {order.courier_tracking && (
          <div className="min-w-0">
            <dt className="text-gray-400">Tracking courier</dt>
            <dd className="break-words font-medium text-gray-800">{order.courier_tracking}</dd>
          </div>
        )}
        {order.proveedor && (
          <div className="min-w-0">
            <dt className="text-gray-400">Proveedor (compra asociada)</dt>
            <dd className="break-words font-medium text-gray-800">{order.proveedor}</dd>
          </div>
        )}
        {order.numero_pedido_compra && (
          <div className="min-w-0">
            <dt className="text-gray-400">N° pedido de compra</dt>
            <dd className="break-words font-medium text-gray-800">{order.numero_pedido_compra}</dd>
          </div>
        )}
        {order.nota && (
          <div className="col-span-2 min-w-0">
            <dt className="text-gray-400">Nota</dt>
            <dd className="break-words font-medium text-gray-800">{order.nota}</dd>
          </div>
        )}
        {/* Distinta de "Nota" a propósito: la nota la escribe Ventas al crear
            el pedido; esto lo escribe quien opera (recoge o cierra) para
            dejar constancia de una eventualidad. El hilo completo, con quién
            y cuándo, está en el Historial — acá se ve solo la más reciente. */}
        {order.observaciones && (
          <div className="col-span-2 min-w-0">
            <dt className="text-gray-400">Observaciones</dt>
            <dd className="break-words font-medium text-gray-800">{order.observaciones}</dd>
          </div>
        )}
      </dl>

      {/* Modalidad (almacén/admin) */}
      {canAssign && order.estado !== "completado" && !estaAnulada && (
        <ModalidadForm
          orderId={order.id}
          modalidad={order.modalidad}
          courierTracking={order.courier_tracking}
          tipo={order.tipo}
        />
      )}

      {/* Asignar (almacén/admin) */}
      {canAssign && order.estado !== "completado" && !estaAnulada && (
        <AsignarForm
          orderId={order.id}
          assignedTo={order.assigned_to}
          repartidores={repartidores}
        />
      )}

      {/* Ventas corrige datos mientras la orden siga sin tomarse. */}
      {puedeEditar && (
        <EditarOrdenForm
          orderId={order.id}
          tipo={order.tipo}
          valores={{
            cliente: order.cliente,
            proyecto: order.proyecto,
            nota: order.nota,
            proveedor: order.proveedor,
            numero_pedido_compra: order.numero_pedido_compra,
          }}
        />
      )}

      {/* Almacén: despachar la orden en varias guías de remisión. */}
      {puedeDividir && <DividirEnvioForm orderId={order.id} />}

      {/* Repartidor: confirma (sube evidencia, sin decir si llegó completo). */}
      {puedeConfirmarTransito && <ConfirmarTransitoForm orderId={order.id} tipo={order.tipo} />}

      {/* Cerrar / contar: exclusivo de Almacén y Admin, y siempre directo —
          en cualquier estado, incluso sin repartidor asignado. Antes, cuando
          la modalidad era Reparto, a Almacén se le escondía detrás de un paso
          extra de confirmación para que no la cerrara sin querer; en la
          práctica estorbaba, porque hay entregas que Almacén cierra sin que
          pase por la ruta. */}
      {!puedeConfirmarTransito && canComplete && (
        <CompletarForm
          orderId={order.id}
          tipo={order.tipo}
          verificando={estaEnTransito}
          numeroGuiaActual={order.numero_guia}
          guiasActuales={imagenesGuia}
          materialActual={imagenesMaterial}
        />
      )}

      {isRepartidor && isMine && estaEnTransito && (
        <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800">
          Ya confirmaste — Almacén se encarga de contar y cerrar la orden.
        </p>
      )}

      {isRepartidor && order.estado !== "completado" && !isMine && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Esta orden aún no está asignada a ti.
        </p>
      )}

      {/* Guía (cuando ya se completó). Solo Cotizaciones: la guía la emite
          SkyHigh y solo aplica a clientes — la del proveedor nunca se
          registra. Un Pedido antiguo que sí tenga (de antes de este cambio)
          se deja guardado pero se oculta acá, para no confundir. */}
      {order.tipo === "entrega" && imagenesGuia.length > 0 && (
        <div>
          <h2 className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-medium text-gray-500">
            Guía {imagenesGuia.length > 1 && `(${imagenesGuia.length} fotos)`}
            {order.numero_guia && (
              <span className="font-semibold text-gray-700">N° {order.numero_guia}</span>
            )}
            {/* La guía se descarga como PDF (una página por foto): se toma con
                la cámara, pero quien la archiva o la manda por correo la
                necesita en PDF. Las fotos sueltas siguen disponibles una a una
                desde la galería de abajo. */}
            {puedeDescargarGuias && (
              <a
                href={`/api/guia-pdf?orden=${order.id}`}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-600 transition hover:border-brand hover:text-brand"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
                Descargar PDF
              </a>
            )}
          </h2>
          <ImageGallery
            urls={imagenesGuia}
            alt="Foto de la guía"
            descargaPrefijo={`guia-${order.numero_guia || order.numero_pedido}`}
          />
        </div>
      )}

      {/* Material (fotos opcionales del bulto/producto, aparte de la guía) */}
      {imagenesMaterial.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-gray-500">
            Material {imagenesMaterial.length > 1 && `(${imagenesMaterial.length} fotos)`}
          </h2>
          <ImageGallery
            urls={imagenesMaterial}
            alt="Foto del material"
            descargaPrefijo={`material-${order.numero_pedido}`}
          />
        </div>
      )}

      {/* Anular: el cliente canceló la OC. Conserva la orden y su historial. */}
      {puedeAnular && <AnularOrdenForm orderId={order.id} />}

      {/* Eliminar (solo Admin) */}
      {puedeEliminar && <EliminarOrdenButton orderId={order.id} />}
    </div>
  );
}
