"use client";

import { useEffect, useRef, useState } from "react";
import { updateMyLocation } from "@/app/(app)/location-actions";

const MIN_INTERVAL_MS = 20_000; // no enviar más de 1 vez cada 20s

export function LocationSharer() {
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const watchId = useRef<number | null>(null);
  const lastSent = useRef<number>(0);

  function stop() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setSharing(false);
    setStatus("");
  }

  function start() {
    if (!("geolocation" in navigator)) {
      setStatus("Este dispositivo no permite ubicación.");
      return;
    }
    setSharing(true);
    setStatus("Obteniendo ubicación...");

    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastSent.current < MIN_INTERVAL_MS) return;
        lastSent.current = now;
        const { latitude, longitude, accuracy } = pos.coords;
        const res = await updateMyLocation(latitude, longitude, accuracy);
        setStatus(
          res.ok
            ? `Compartiendo · ${new Date().toLocaleTimeString("es-PE", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "No se pudo enviar la ubicación."
        );
      },
      (err) => {
        setStatus(
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación denegado."
            : "No se pudo obtener la ubicación."
        );
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );
  }

  // Limpieza al desmontar.
  useEffect(() => {
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-sm">
        <p className="font-medium text-gray-800">
          {sharing ? "📍 Compartiendo ubicación" : "Compartir mi ubicación"}
        </p>
        <p className="text-xs text-gray-500">
          {status || "Permite que almacén vea tu posición en el mapa mientras repartes."}
        </p>
      </div>
      <button
        onClick={sharing ? stop : start}
        className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
          sharing
            ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
            : "bg-brand text-white hover:bg-brand-dark"
        }`}
      >
        {sharing ? "Detener" : "Activar"}
      </button>
    </div>
  );
}
