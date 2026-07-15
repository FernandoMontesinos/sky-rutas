import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ModalidadBadge, StatusBadge, TypeBadge } from "@/components/badges";
import { ImageGallery } from "@/components/image-gallery";
import { deleteOrder } from "../actions";
import { ModalidadForm } from "./modalidad-form";
import { AsignarForm } from "./asignar-form";
import CompletarForm from "./completar";
import { MODALIDAD_LABEL, type OrderWithNames, type Profile } from "@/lib/types";

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
  // Almacén termina su trabajo en "asignar" cuando hay un repartidor de por
  // medio (modalidad reparto) — es el repartidor quien confirma desde su
  // celular. En oficina/courier no hay repartidor, así que almacén sí
  // completa directo. Admin siempre puede, para soporte/corrección.
  const canComplete =
    order.estado !== "completado" &&
    (profile.role === "admin" ||
      (isAlmacen && order.modalidad !== "reparto") ||
      (isRepartidor && isMine));

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
    <div className="space-y-5">
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

      {/* Imágenes de la orden */}
      {imagenesOrden.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-gray-500">
            Orden {imagenesOrden.length > 1 && `(${imagenesOrden.length} imágenes)`}
          </h2>
          <ImageGallery urls={imagenesOrden} alt="Imagen de la orden" />
        </div>
      )}

      {/* Datos */}
      <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <div className="col-span-2 min-w-0">
          <dt className="text-gray-400">{order.tipo === "recojo" ? "Proveedor" : "Cliente"}</dt>
          <dd className="break-words font-medium text-gray-800">{order.cliente || "—"}</dd>
        </div>
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
        <div className="min-w-0">
          <dt className="text-gray-400">Completada</dt>
          <dd className="break-words font-medium text-gray-800">{fmt(order.completed_at) ?? "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-400">Modalidad</dt>
          <dd className="break-words font-medium text-gray-800">{MODALIDAD_LABEL[order.modalidad]}</dd>
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

      {isAlmacen && order.modalidad === "reparto" && order.estado !== "completado" && (
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
          Es reparto por repartidor — {order.repartidor?.full_name ?? "el repartidor asignado"}{" "}
          confirma la entrega/recojo desde su celular. Tu parte termina en asignar.
        </p>
      )}

      {/* Completar:
          - repartidor: solo si la orden es suya (asignada)
          - almacén: solo oficina/courier (en reparto lo hace el repartidor)
          - admin: siempre, para soporte */}
      {canComplete && (isRepartidor ? order.assigned_to : true) && (
        <CompletarForm orderId={order.id} tipo={order.tipo} />
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
