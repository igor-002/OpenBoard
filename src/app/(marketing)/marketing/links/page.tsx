import { requireTool } from "@/lib/permissions";
import { listShortLinks } from "@/server/marketing/short-links";
import { LinksManager } from "@/components/marketing/LinksManager";

export default async function LinksPage() {
  await requireTool("marketing.links");
  const { base, links, campaigns } = await listShortLinks();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Links &amp; QR</h1>
          <p className="page-sub">
            Links curtos dinâmicos com QR Code para campanhas e panfletagem. O QR aponta pra URL
            curta — o destino pode ser trocado a qualquer momento sem reimprimir nada.
          </p>
        </div>
      </div>
      <LinksManager shortBase={base} campaigns={campaigns} links={links} />
    </div>
  );
}
