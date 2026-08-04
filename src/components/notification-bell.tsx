"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { playNotificationSound } from "@/lib/notification-sound";

type Notif = {
  id: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  order_id: string | null;
  created_at: string;
};

function tiempoRelativo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
}

export function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const supabaseRef = useRef(createClient());
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    const { data } = await supabaseRef.current
      .from("notifications")
      .select("id, titulo, mensaje, leida, order_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Notif[]);
  }, [userId]);

  useEffect(() => {
    load();
    const supabase = supabaseRef.current;

    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          if (!firstLoad.current) playNotificationSound();
          load();
        }
      )
      .subscribe();

    // Red de seguridad si Realtime no entrega el evento (ver notas en
    // realtime-refresher.tsx): igual se refresca solo cada 30s.
    const interval = setInterval(load, 30_000);
    firstLoad.current = false;

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userId, load]);

  const unread = items.filter((n) => !n.leida).length;

  async function marcarLeidas() {
    if (unread === 0) return;
    await supabaseRef.current
      .from("notifications")
      .update({ leida: true })
      .eq("user_id", userId)
      .eq("leida", false);
    setItems((prev) => prev.map((n) => ({ ...n, leida: true })));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) marcarLeidas();
        }}
        className="relative rounded-lg p-2 text-gray-600 transition hover:bg-gray-100"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" strokeWidth={2} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          {/*
            En celular el panel va fijo al ancho de la pantalla (con un margen
            a cada lado) en vez de colgar de la campanita: anclado a la derecha
            del botón, sus 320px se salían por el borde IZQUIERDO —la campanita
            está a ~230px del borde en un celular angosto— y el texto quedaba
            cortado. De sm en adelante sigue siendo el desplegable de antes.
          */}
          <div className="fixed inset-x-2 top-16 z-40 rounded-xl border border-gray-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
            <div className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
              Notificaciones
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-400">Sin notificaciones todavía.</p>
              ) : (
                items.map((n) => (
                  <Link
                    key={n.id}
                    href={n.order_id ? `/ordenes/${n.order_id}` : "/ordenes"}
                    onClick={() => setOpen(false)}
                    className="block border-b border-gray-50 px-3 py-2.5 text-sm transition hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-gray-800">{n.titulo}</span>
                      <span className="shrink-0 text-[11px] text-gray-400">{tiempoRelativo(n.created_at)}</span>
                    </div>
                    <div className="text-xs text-gray-500">{n.mensaje}</div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
