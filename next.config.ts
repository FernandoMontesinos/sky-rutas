import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Las fotos se comprimen en el navegador, pero subimos este límite
      // como red de seguridad. Ahora se pueden enviar varias imágenes en
      // un mismo formulario (orden y guía), por eso el margen es mayor.
      bodySizeLimit: "24mb",
    },
  },
};

export default nextConfig;
