import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

const vapidReady =
  !!process.env.VAPID_PRIVATE_KEY && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

if (vapidReady) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:soporte@skyhigh.pe",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export type NotifTipo =
  | "orden_pendiente"
  | "orden_asignada"
  | "orden_en_transito"
  | "orden_completada"
  | "orden_parcial";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function sendPushToUser(
  supabase: Supabase,
  userId: string,
  payload: { title: string; body: string; url: string }
) {
  if (!vapidReady) return;
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        // urgency "high" pide entrega inmediata al servicio push (FCM en
        // Android/Chrome) en vez de esperar a que el celular salga de
        // ahorro de batería/Doze — sin esto la notificación puede demorar
        // minutos u horas en aparecer en la barra del sistema.
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          body,
          { urgency: "high" }
        );
      } catch (err) {
        // Suscripción vencida o inválida (celular desinstaló, permiso revocado, etc.)
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    })
  );
}

/**
 * Crea una notificación (campanita) para uno o varios usuarios y, si
 * están suscritos, además intenta mandarles un push real del navegador.
 * El push es "mejor esfuerzo": si falla o no hay suscripción, la
 * notificación igual queda guardada y visible en la campanita.
 */
export async function notify(
  userIds: string[],
  opts: { tipo: NotifTipo; titulo: string; mensaje: string; orderId?: string; url?: string }
) {
  const unicos = [...new Set(userIds)];
  if (unicos.length === 0) return;

  const supabase = await createClient();
  const url = opts.url ?? (opts.orderId ? `/ordenes/${opts.orderId}` : "/ordenes");

  await supabase.from("notifications").insert(
    unicos.map((user_id) => ({
      user_id,
      order_id: opts.orderId ?? null,
      tipo: opts.tipo,
      titulo: opts.titulo,
      mensaje: opts.mensaje,
    }))
  );

  await Promise.all(
    unicos.map((id) => sendPushToUser(supabase, id, { title: opts.titulo, body: opts.mensaje, url }))
  );
}

/** Ids de usuarios activos con el rol dado (para notificar a "todo almacén", etc.). */
export async function userIdsByRole(role: UserRole): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", role)
    .eq("activo", true);
  return (data ?? []).map((p) => p.id as string);
}
