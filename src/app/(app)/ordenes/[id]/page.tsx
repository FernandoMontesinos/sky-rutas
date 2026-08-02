import Link from "next/link";
import { notFound } from "next/navigation";
import { GitBranch } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ModalidadBadge, StatusBadge, TypeBadge } from "@/components/badges";
import { ImageGallery } from "@/components/image-gallery";
import { deleteOrder } from "../actions";
import { ModalidadForm } from "./modalidad-form";
import { AsignarForm } from "./asignar-form";
import { AlmacenOverrideCompletar } from "./almacen-override";
import CompletarForm, { RecojoForm } from "./completar";
import { DividirEnvioForm } from "./dividir-envio";
import { modalidadLabel, type OrderWithNames, type Profile } from "@/lib/types";

const SELECT =
  "*, creador:profiles!orders_created_by_fkey(full_name), repartidor:profiles!orders_assigned_to_fkey(full_name)";

function fmt(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

  const canAssign = profile.role === "admin" || profile.role === "almacen";
  const isMine = order.assigned_to === userId;
  const isRepartidor = profile.role === "repartidor";
  const isAlmacen = profile.role === "almacen";
  // Mismos roles que ahora permite la política RLS de UPDATE sobre orders:
  // admin/almacén siempre, el repartidor asignado, o quien creó la orden.
  const puedeEditarAdjuntos =
    canAssign || (isRepartidor && isMine) || order.created_by === userId;
  // Almacén normalmente termina su trabajo en "asignar" cuando hay un
  // repartidor de por medio (modalidad reparto) — es el repartidor quien
  // confirma desde su celular. Pero conserva la opción de completarla él
  // mismo si hace falta (ver AlmacenOverrideCompletar), solo que no se le
  // muestra de entrada para evitar que la marque sin querer.
  const almacenReparto = isAlmacen && order.modalidad === "reparto";
  const canComplete =
    order.estado !== "completado" &&
    (profile.role === "admin" || isAlmacen || (isRepartidor && isMine));

  // Un Pedido (Proveedor) que todavía tiene que ir a recoger el repartidor:
  // él solo sube la guía y confirma el recojo, sin decir si llegó completo
  // (recibe bultos sellados, no cuenta ítems). Almacén/admin sí pueden
  // cerrarla directo desde "asignado" — es el caso de los pedidos que no
  // pasan por un repartidor (Recepción en oficina / Courier).
  const esRecojoPorConfirmar =
    order.tipo === "recojo" && order.estado === "asignado" && isRepartidor && isMine;
  // Ya se recogió y falta contar la mercadería: la cierra quien la cuente
  // (almacén al recibirla, o el repartidor si fue directo al cliente).
  const estaEnTransito = order.estado === "en_transito";
  // Almacén puede partir la orden en varios envíos mientras no esté cerrada.
  const puedeDividir = canAssign && order.estado !== "completado";

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

  let repartidores: Profile[] = [];
  if (canAssign) {
    const { data: reps } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "repartidor")
      .eq("activo", true)
      .order("full_name");
    repartidores = (reps ?? []) as Profile[];
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/ordenes"
        className="inline-flex items-center gap-1 py-1 text-sm font-medium text-gray-500 hover:text-brand"
      >
        ‹ Volver a órdenes
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-900">#{order.numero_pedido}</h1>
        <TypeBadge tipo={order.tipo} />
        <ModalidadBadge modalidad={order.modalidad} />
        <StatusBadge estado={order.estado} parcial={order.entrega_parcial} />
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
          />
        </div>
      )}

      {/* Intento(s) fallido(s) de recojo: almacén necesita verlo para
          coordinar con el proveedor antes de volver a asignarla. */}
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
            <dt className="text-gray-400">Recogida</dt>
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
      </dl>

      {/* Modalidad (almacén/admin) */}
      {canAssign && order.estado !== "completado" && (
        <ModalidadForm
          orderId={order.id}
          modalidad={order.modalidad}
          courierTracking={order.courier_tracking}
          tipo={order.tipo}
        />
      )}

      {/* Asignar (almacén/admin) */}
      {canAssign && order.estado !== "completado" && (
        <AsignarForm
          orderId={order.id}
          assignedTo={order.assigned_to}
          repartidores={repartidores}
        />
      )}

      {/* Almacén: despachar la orden en varias guías de remisión. */}
      {puedeDividir && <DividirEnvioForm orderId={order.id} />}

      {/* Paso 1 de un Pedido: el repartidor confirma el recojo (sin contar). */}
      {esRecojoPorConfirmar && <RecojoForm orderId={order.id} />}

      {/* Completar / verificar: lo hace quien contó la mercadería.
          - repartidor: solo si la orden es suya (asignada)
          - almacén en reparto: oculto detrás de un paso extra (ver arriba),
            salvo que ya esté En Tránsito — ahí verificar SÍ es su trabajo
          - almacén en oficina/courier y admin: directo */}
      {!esRecojoPorConfirmar && canComplete && (isRepartidor ? order.assigned_to : true) && (
        almacenReparto && !estaEnTransito ? (
          <AlmacenOverrideCompletar repartidorNombre={order.repartidor?.full_name ?? "el repartidor asignado"}>
            <CompletarForm orderId={order.id} tipo={order.tipo} />
          </AlmacenOverrideCompletar>
        ) : (
          <CompletarForm orderId={order.id} tipo={order.tipo} verificando={estaEnTransito} />
        )
      )}

      {isRepartidor && order.estado !== "completado" && !isMine && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Esta orden aún no está asignada a ti.
        </p>
      )}

      {/* Guía (cuando ya se completó) */}
      {imagenesGuia.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-gray-500">
            Guía {imagenesGuia.length > 1 && `(${imagenesGuia.length} fotos)`}
          </h2>
          <ImageGallery urls={imagenesGuia} alt="Foto de la guía" />
        </div>
      )}

      {/* Eliminar (admin) */}
      {profile.role === "admin" && (
        <form action={deleteOrder}>
          <input type="hidden" name="order_id" value={order.id} />
          <button
            type="submit"
            className="text-sm text-gray-400 underline hover:text-brand"
          >
            Eliminar orden
          </button>
        </form>
      )}
    </div>
  );
}
