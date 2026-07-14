"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormResult = { error?: string; ok?: boolean };

function extFromType(type: string, fallback: string) {
  const ext = type.split("/")[1];
  if (!ext) return fallback;
  return ext === "jpeg" ? "jpg" : ext;
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
  const { userId } = await requireRole(["vendedor", "admin"]);

  const numero = String(formData.get("numero_pedido") ?? "").trim();
  const cliente = String(formData.get("cliente") ?? "").trim() || null;
  const tipo = String(formData.get("tipo") ?? "");
  const modalidad = String(formData.get("modalidad") ?? "reparto");
  const courierTracking = String(formData.get("courier_tracking") ?? "").trim() || null;
  const nota = String(formData.get("nota") ?? "").trim() || null;
  const imagenes = formData.getAll("imagenes").filter((f): f is File => f instanceof File && f.size > 0);

  if (!numero) return { error: "Ingresa el número de pedido." };
  if (tipo !== "entrega" && tipo !== "recojo")
    return { error: "Selecciona si es ENTREGA o RECOJO." };
  if (!["reparto", "oficina", "courier"].includes(modalidad))
    return { error: "Modalidad de entrega inválida." };
  if (imagenes.length === 0)
    return { error: "Agrega al menos una imagen de la orden (pégala o toma una foto)." };

  const supabase = await createClient();
  const { urls, error: upErr } = await uploadMany(supabase, "ordenes", userId, imagenes);
  if (upErr) return { error: "No se pudo subir la imagen: " + upErr };

  const { error: insErr } = await supabase.from("orders").insert({
    numero_pedido: numero,
    cliente,
    tipo,
    modalidad,
    courier_tracking: modalidad === "courier" ? courierTracking : null,
    nota,
    imagen_url: urls[0] ?? null,
    imagenes_urls: urls,
    created_by: userId,
    estado: "pendiente",
  });
  if (insErr) return { error: insErr.message };

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
  } else {
    await supabase
      .from("orders")
      .update({
        assigned_to: repartidorId,
        estado: "asignado",
        assigned_at: new Date().toISOString(),
      })
      .eq("id", orderId);
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

  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath("/ordenes");
}

/** Sube una o más fotos de la guía/comprobante y marca la orden como
 *  completada (total o parcial). Repartidor: solo sus órdenes propias.
 *  Almacén/Admin: cualquiera (oficina/courier). */
export async function completeOrder(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  await requireRole(["repartidor", "almacen", "admin"]);

  const orderId = String(formData.get("order_id") ?? "");
  const parcial = String(formData.get("entrega_parcial") ?? "") === "true";
  const guias = formData.getAll("guias").filter((f): f is File => f instanceof File && f.size > 0);

  if (!orderId) return { error: "Orden inválida." };
  if (guias.length === 0)
    return { error: "Toma al menos una foto de la guía antes de confirmar." };

  const supabase = await createClient();
  const { urls, error: upErr } = await uploadMany(supabase, "guias", orderId, guias);
  if (upErr) return { error: "No se pudo subir la foto: " + upErr };

  const { error } = await supabase
    .from("orders")
    .update({
      guia_url: urls[0] ?? null,
      guias_urls: urls,
      entrega_parcial: parcial,
      estado: "completado",
      completed_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) return { error: error.message };

  revalidatePath(`/ordenes/${orderId}`);
  revalidatePath("/ordenes");
  redirect("/ordenes");
}

/** Admin elimina una orden. */
export async function deleteOrder(formData: FormData): Promise<void> {
  await requireRole(["admin"]);
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return;

  const supabase = await createClient();
  await supabase.from("orders").delete().eq("id", orderId);

  revalidatePath("/ordenes");
  redirect("/ordenes");
}
