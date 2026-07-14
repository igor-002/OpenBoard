// Baixa/atualiza o banco MaxMind GeoLite2-City (.mmdb) usado pela
// geolocalização do encurtador (src/lib/short/geo.ts).
//
//   npm run geoip:update
//
// Requer MAXMIND_LICENSE_KEY (conta gratuita em maxmind.com → Manage License
// Keys). Destino: GEOIP_DB_PATH ou geoip/GeoLite2-City.mmdb. Rodar semanal
// (cron) — o app detecta o arquivo novo sozinho (checa mtime a cada hora).
import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";

function envVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  for (const f of [".env.production", ".env"]) {
    try {
      const m = readFileSync(f, "utf8").match(new RegExp(`^${name}=["']?([^"'\\r\\n]+)`, "m"));
      if (m) return m[1].trim();
    } catch {
      /* arquivo não existe — tenta o próximo */
    }
  }
  return undefined;
}

async function main() {
  const key = envVar("MAXMIND_LICENSE_KEY");
  if (!key) {
    console.error("MAXMIND_LICENSE_KEY ausente — defina no .env (conta gratuita no maxmind.com).");
    process.exit(1);
  }
  const dest = envVar("GEOIP_DB_PATH") || "geoip/GeoLite2-City.mmdb";
  const tmp = join(dirname(dest), ".tmp-geolite2");
  mkdirSync(tmp, { recursive: true });

  console.log("Baixando GeoLite2-City…");
  const res = await fetch(
    `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${encodeURIComponent(key)}&suffix=tar.gz`,
  );
  if (!res.ok) {
    console.error(`Download falhou: HTTP ${res.status} (chave inválida ou limite diário).`);
    process.exit(1);
  }
  const tarPath = join(tmp, "geolite2-city.tar.gz");
  writeFileSync(tarPath, Buffer.from(await res.arrayBuffer()));

  // tar existe no Windows 10+ e em qualquer Linux.
  execSync(`tar -xzf "${tarPath}" -C "${tmp}"`);
  const extracted = readdirSync(tmp).find((d) => d.startsWith("GeoLite2-City_"));
  if (!extracted) {
    console.error("Arquivo .mmdb não encontrado no tar baixado.");
    process.exit(1);
  }
  renameSync(join(tmp, extracted, "GeoLite2-City.mmdb"), dest);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`ok -> ${dest}`);
}

main();
