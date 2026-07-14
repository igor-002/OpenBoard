import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // imagem Docker enxuta para a VPS
  // @react-pdf/renderer não empacota bem (Turbopack: "CJS module can't be async")
  // — roda como dependência externa do Node no server.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Subcaminho quando atrás de proxy. Vazio = raiz (dev local e prod com domínio
  // próprio — crm.opensuite.com.br). Definido no build via env BASE_PATH.
  basePath: process.env.BASE_PATH || undefined,
  // Espelha o basePath pro bundle client (inlined no build) — usado por
  // src/lib/basePath.ts pra prefixar fetch/EventSource/<a href> montados à mão.
  env: { NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH || "" },
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
