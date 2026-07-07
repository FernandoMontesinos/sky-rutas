import type { MetadataRoute } from "next";

/**
 * Manifest PWA: permite que al "Agregar a pantalla de inicio" en el celular
 * la app se abra a pantalla completa (sin barra del navegador), con nombre
 * e ícono propios — clave para los repartidores.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SkyHigh Rutas",
    short_name: "Rutas",
    description: "Gestión de rutas de entrega y recojo — SkyHigh SAC",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#dc2626",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
