"use client";

import { useEffect, useRef, useState } from "react";
import { updateMyLocation } from "@/app/(app)/location-actions";

const MIN_INTERVAL_MS = 20_000; // no enviar más de 1 vez cada 20s

export function LocationSharer() {
  const [active, setActive] = useState(false);
  const [denied, setDenied] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef<number>(0);

  function startWatch() {
    if (!("geolocation" in navigator) || watchId.current !== null) return;

    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setActive(true);
        setDenied(false);
        const now = Date.now();
        if (now - lastSent.current < MIN_INTERVAL_MS) return;
        lastSent.current = now;
        const { latitude, longitude, accuracy } = pos.coords;
        await updateMyLocation(latitude, longitude, accuracy);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setDenied(true);
        setActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );
  }

  // Arranca automáticamente al entrar a la app.
  useEffect(() => {
    startWatch();
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (denied) {
    return (
      <div className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
        📍 Activa el permiso de ubicación en tu navegador para que almacén vea tu posición.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-1.5 text-xs text-green-800">
      <span className={`inline-block h-2 w-2 rounded-full ${active ? "bg-green-500" : "bg-gray-300"}`} />
      {active ? "Compartiendo tu ubicación" : "Activando ubicación..."}
    </div>
  );
}
