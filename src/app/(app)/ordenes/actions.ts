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

/** Vendedor/Admin crea una orden subiendo la imagen pegada. */
export async function createOrder(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  const { userId } = await requireRole(["vendedor", "admin"]);

  const numero = String(formData.get("numero_pedido") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "");
  const nota = String(formData.get("nota") ?? "").trim() || null;
  const imagen = formData.get("imagen") as File | null;

  if (!numero) return { error: "Ingresa el número de pedido." };
  if (tipo !== "entrega" && tipo !== "recojo")
    return { error: "Selecciona si es ENTREGA o RECOJO." };
  if (!imagen || imagen.size === 0)
    return { error: "Agrega la imagen de la orden (pégala o toma una foto)." };

  const supabase = await createClient();
  const path = `${userId}/${Date.now()}.${extFromType(imagen.type, "png")}`;

  const { error: upErr } = await supabase.storage
    .from("ordenes")
    .upload(path, imagen, { contentType: imagen.type, upsert: false });
  if (upErr) return { error: "No se pudo subir la imagen: " + upErr.message };

  const { data: pub } = supabase.storage.from("ordenes").getPublicUrl(path);

  const { error: insErr } = await supabase.from("orders").insert({
    numero_pedido: numero,
    tipo,
    nota,
    imagen_url: pub.publicUrl,
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

/** Sube la foto de la guía/comprobante y marca la orden como completada.
 *  Repartidor: solo sus órdenes. Almacén/Admin: cualquiera (oficina/courier). */
export async function completeOrder(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  await requireRole(["repartidor", "almacen", "admin"]);

  const orderId = String(formData.get("order_id") ?? "");
  const guia = formData.get("guia") as File | null;

  if (!orderId) return { error: "Orden inválida." };
  if (!guia || guia.size === 0)
    return { error: "Toma la foto de la guía antes de confirmar." };

  const supabase = await createClient();
  const path = `${orderId}/${Date.now()}.${extFromType(guia.type, "jpg")}`;

  const { error: upErr } = await supabase.storage
    .from("guias")
    .upload(path, guia, { contentType: guia.type, upsert: false });
  if (upErr) return { error: "No se pudo subir la foto: " + upErr.message };

  const { data: pub } = supabase.storage.from("guias").getPublicUrl(path);

  const { error } = await supabase
    .from("orders")
    .update({
      guia_url: pub.publicUrl,
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
