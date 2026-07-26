"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Ofrece activar notificaciones push. En iPhone, Apple solo las permite
 * si la app se agregó antes a la pantalla de inicio (no hay forma de
 * evitar esto desde el código) — por eso se detecta el caso y se explica
 * en vez de mostrar un botón que fallaría en silencio.
 */
export function PushPrompt({ userId }: { userId: string }) {
  const [state, setState] = useState({ visible: false, needsInstall: false });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem("push-prompt-dismissed")) return;

    // Necesita window/Notification/localStorage, que no existen en el
    // servidor: el efecto (no el render) es lo correcto aquí para evitar
    // un mismatch de hidratación entre servidor y cliente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ visible: true, needsInstall: isIos() && !isStandalone() });
  }, []);
  const { visible, needsInstall } = state;

  async function activar() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((s) => ({ ...s, visible: false }));
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) return;

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

      const supabase = createClient();
      await supabase.from("push_subscriptions").insert({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth_key: json.keys.auth,
      });
    } finally {
      setState((s) => ({ ...s, visible: false }));
    }
  }

  function descartar() {
    localStorage.setItem("push-prompt-dismissed", "1");
    setState((s) => ({ ...s, visible: false }));
  }

  if (!visible) return null;

  return (
    <div className="flex items-start gap-2 rounded-xl border border-brand/20 bg-brand/5 p-3 text-sm">
      <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.25} />
      <div className="flex-1">
        {needsInstall ? (
          <>
            <p className="font-medium text-gray-800">Recibe avisos en tu iPhone</p>
            <p className="text-gray-600">
              Toca <b>Compartir</b> → <b>Agregar a inicio</b> y abre la app desde ahí para activar
              notificaciones (es una limitación de Apple, no nuestra).
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-gray-800">Activa las notificaciones</p>
            <p className="text-gray-600">Te avisamos cuando haya una orden nueva o un cambio importante.</p>
            <button
              type="button"
              onClick={activar}
              className="mt-1.5 font-semibold text-brand underline underline-offset-2"
            >
              Activar
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={descartar}
        aria-label="Cerrar aviso"
        className="text-gray-400 transition hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
