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
    // PNG, no SVG: Chrome en Android ignora los íconos SVG del manifest para
    // el "Agregar a pantalla de inicio" y para el ícono de las notificaciones
    // push — se quedaba con el ícono genérico del navegador. El "maskable"
    // lleva más aire porque el launcher recorta hasta un 20% por lado al
    // adaptarlo a la forma del sistema (círculo, squircle, etc.).
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
