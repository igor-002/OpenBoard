import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // imagem Docker enxuta para a VPS
  // Subcaminho quando atrás de proxy (ex.: IP/openboard). Vazio = raiz (dev local).
  // Definido no build via env BASE_PATH (Dockerfile usa /openboard).
  basePath: process.env.BASE_PATH || undefined,
};

export default nextConfig;
