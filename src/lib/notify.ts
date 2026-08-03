import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  | "orden_editada"
  | "orden_completada"
  | "orden_parcial";

type PushSub = { id: string; user_id: string; endpoint: string; p256dh: string; auth_key: string };

async function sendPushToUser(
  subs: PushSub[],
  payload: { title: string; body: string; url: string }
) {
  if (!vapidReady || subs.length === 0) return;

  // El borrado de una suscripción vencida se hace con service_role: casi
  // siempre se notifica a OTRA persona (vendedor crea -> avisa a almacén,
  // etc.), así que con el cliente de sesión del actor la policy
  // push_subscriptions_delete (user_id = auth.uid()) nunca matchea la fila
  // del destinatario — el delete "funciona" (0 filas, sin error) pero la
  // suscripción muerta queda para siempre y se reintenta en cada push.
  const admin = createAdminClient();

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
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("[notify] fallo de push no manejado", { statusCode, userId: s.user_id });
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

  // Se mira el error a propósito: supabase-js no lanza excepción ante un fallo
  // de base, devuelve { error }. Sin esto, un tipo que no existe en el enum
  // notif_tipo (o cualquier rechazo de RLS) desaparecía sin dejar rastro y la
  // notificación simplemente no llegaba, sin forma de saber por qué.
  const { error } = await supabase.from("notifications").insert(
    unicos.map((user_id) => ({
      user_id,
      order_id: opts.orderId ?? null,
      tipo: opts.tipo,
      titulo: opts.titulo,
      mensaje: opts.mensaje,
    }))
  );
  if (error) {
    console.error("[notify] no se pudo guardar la notificación", {
      tipo: opts.tipo,
      code: error.code,
      message: error.message,
    });
  }

  if (vapidReady) {
    // Una sola consulta para todos los destinatarios en vez de una por
    // usuario: notify() ya recibe la lista completa, así que N+1 acá era
    // innecesario — el mismo payload se manda a todas las suscripciones.
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth_key")
      .in("user_id", unicos);
    await sendPushToUser((subs ?? []) as PushSub[], { title: opts.titulo, body: opts.mensaje, url });
  }
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
