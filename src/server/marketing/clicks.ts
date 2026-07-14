// Registro assíncrono de clique/scan do encurtador. Roda dentro de after()
// no redirect — nunca no caminho da response. Grava o evento imediatamente
// (UA/referrer/hash) e enriquece com geo depois, em update separado:
// se a API de geo falhar/estourar cota, o clique já está contado.
import "server-only";
import { userAgent } from "next/server";
import { db } from "@/lib/db";
import { geoLookup } from "@/lib/short/geo";
import { hashIp } from "@/lib/short/ip";

export async function recordClick(input: {
  linkId: string;
  ua: string | null;
  referer: string | null;
  ip: string | null;
}): Promise<void> {
  try {
    const parsed = userAgent({ headers: new Headers(input.ua ? { "user-agent": input.ua } : {}) });
    const click = await db.linkClick.create({
      data: {
        linkId: input.linkId,
        ipHash: input.ip ? hashIp(input.ip) : null,
        // device.type undefined = desktop (convenção do parser)
        deviceType: parsed.device.type ?? "desktop",
        os: parsed.os.name ?? null,
        browser: parsed.browser.name ?? null,
        referrer: input.referer,
        isBot: parsed.isBot,
      },
      select: { id: true },
    });

    if (input.ip) {
      const geo = await geoLookup(input.ip);
      if (geo) {
        await db.linkClick.update({
          where: { id: click.id },
          data: { country: geo.country, region: geo.region, city: geo.city },
        });
      }
    }
  } catch (e) {
    // Analytics nunca derruba nada — o redirect já foi entregue.
    console.error("[short] falha ao registrar clique:", e instanceof Error ? e.message : e);
  }
}
