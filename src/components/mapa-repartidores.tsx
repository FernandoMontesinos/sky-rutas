"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { OrderType } from "@/lib/types";

export type RepMarker = {
  userId: string;
  nombre: string;
  lat: number;
  lng: number;
  updatedAt: string;
  ordenes: { numero: string; tipo: OrderType }[];
};

function popupHtml(m: RepMarker) {
  const hora = new Date(m.updatedAt).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const items =
    m.ordenes.length > 0
      ? m.ordenes
          .map(
            (o) =>
              `<li>#${o.numero} <b style="text-transform:uppercase">${o.tipo}</b></li>`
          )
          .join("")
      : "<li>Sin órdenes asignadas</li>";
  return `
    <div style="min-width:160px">
      <div style="font-weight:700">🚚 ${m.nombre}</div>
      <div style="font-size:11px;color:#6b7280">Actualizado: ${hora}</div>
      <ul style="margin:6px 0 0;padding-left:16px">${items}</ul>
    </div>`;
}

export default function MapaRepartidores({
  markers,
  center,
}: {
  markers: RepMarker[];
  center: [number, number];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current).setView(center, markers.length ? 13 : 11);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const bounds: [number, number][] = [];
      for (const m of markers) {
        L.circleMarker([m.lat, m.lng], {
          radius: 10,
          color: "#991b1b",
          fillColor: "#dc2626",
          fillOpacity: 0.9,
          weight: 2,
        })
          .addTo(map)
          .bindTooltip(m.nombre, { permanent: true, direction: "top", offset: [0, -8] })
          .bindPopup(popupHtml(m));
        bounds.push([m.lat, m.lng]);
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    })();

    return () => {
      cancelled = true;
      const map = mapRef.current as { remove?: () => void } | null;
      if (map?.remove) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, [markers, center]);

  return (
    <div
      ref={containerRef}
      className="h-[70vh] w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
    />
  );
}
