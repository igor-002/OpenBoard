import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // imagem Docker enxuta para a VPS
  // Subcaminho quando atrás de proxy (ex.: IP/openboard). Vazio = raiz (dev local).
  // Definido no build via env BASE_PATH (Dockerfile usa /openboard).
  basePath: process.env.BASE_PATH || undefined,
  async headers() {
    const headers = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    // HSTS só faz sentido sob HTTPS. Ligue junto com COOKIE_SECURE=true quando servir por TLS.
    if (process.env.COOKIE_SECURE === "true") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
