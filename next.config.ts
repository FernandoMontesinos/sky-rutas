import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Las fotos se comprimen en el navegador, pero subimos este límite
      // como red de seguridad para que nunca falle el envío de imágenes.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
