"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { fullLabel } from "@/lib/format";
import { toggleLinkAction, deleteLinkAction } from "@/app/(marketing)/marketing/links/actions";
import { LinkFormModal } from "./LinkFormModal";
import { QrModal } from "./QrModal";

export interface LinkRow {
  id: string;
  slug: string;
  shortUrl: string;
  destination: string;
  title: string;
  kind: string;
  waPhone: string | null;
  waMessage: string | null;
  tags: string;
  active: boolean;
  expiresAt: string | null;
  expired: boolean;
  campaignId: string | null;
  campaignName: string | null;
  qrColor: string;
  qrBgColor: string;
  qrLogo: string | null;
  clicks: number;
  createdAt: string;
}

export interface CampaignOption {
  id: string;
  name: string;
}

function statusBadge(l: LinkRow) {
  if (!l.active) {
    return <span className="badge" style={{ color: "var(--st-risk)", background: "var(--st-risk-bg)" }}>inativo</span>;
  }
  if (l.expired) {
    return <span className="badge" style={{ color: "var(--st-risk)", background: "var(--st-risk-bg)" }}>expirado</span>;
  }
  return <span className="badge" style={{ color: "var(--st-done)", background: "var(--st-done-bg)" }}>ativo</span>;
}

export function LinksManager({
  shortBase,
  links,
  campaigns,
}: {
  shortBase: string;
  links: LinkRow[];
  campaigns: CampaignOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [formFor, setFormFor] = useState<LinkRow | "new" | null>(null);
  const [qrFor, setQrFor] = useState<LinkRow | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return links.filter((l) => {
      if (campaignFilter && l.campaignId !== campaignFilter) return false;
      if (!q) return true;
      return [l.title, l.slug, l.destination, l.tags, l.campaignName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [links, search, campaignFilter]);

  function run(fn: () => Promise<{ ok?: boolean; error?: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.ok) router.refresh();
      else setMsg(r.error ?? "Erro inesperado.");
    });
  }

  function copyUrl(l: LinkRow) {
    navigator.clipboard.writeText(l.shortUrl).then(() => {
      setCopied(l.id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <>
      <div className="row gap12" style={{ alignItems: "center", marginBottom: "var(--gap)", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => setFormFor("new")}>
          <Icon name="plus" size={15} /> Novo link
        </button>
        <Link href="/marketing/links/campanhas" className="btn btn-ghost">
          <Icon name="folder" size={15} /> Campanhas
        </Link>
        <Link href="/marketing/links/relatorios" className="btn btn-ghost">
          <Icon name="chart" size={15} /> Relatório
        </Link>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, slug, destino, tag…"
          className="input"
          style={{ flex: 1, minWidth: 200, maxWidth: 340 }}
        />
        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="input"
          style={{ maxWidth: 220 }}
        >
          <option value="">Todas as campanhas</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {msg && <span className="muted" style={{ fontSize: 12.5 }}>{msg}</span>}
      </div>

      <Card pad={false}>
        {filtered.length === 0 ? (
          <div className="card-pad muted" style={{ padding: 24, textAlign: "center" }}>
            {links.length === 0 ? "Nenhum link criado ainda." : "Nenhum link corresponde ao filtro."}
          </div>
        ) : (
          <table className="tbl" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Link</th>
                <th style={{ textAlign: "left" }}>Destino</th>
                <th style={{ textAlign: "left" }}>Campanha</th>
                <th style={{ textAlign: "right" }}>Cliques</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th style={{ textAlign: "left" }}>Criado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div className="row gap8" style={{ alignItems: "center" }}>
                      <Link href={`/marketing/links/${l.id}`} style={{ fontWeight: 700 }}>
                        {l.title || l.slug}
                      </Link>
                      {l.kind === "whatsapp" && (
                        <span className="badge" style={{ color: "var(--st-done)", background: "var(--st-done-bg)" }}>
                          WhatsApp
                        </span>
                      )}
                    </div>
                    <div className="row gap8" style={{ alignItems: "center" }}>
                      <span className="muted" style={{ fontSize: 12 }}>/r/{l.slug}</span>
                      <button
                        className="icon-btn"
                        title={copied === l.id ? "Copiado!" : "Copiar URL curta"}
                        style={{ width: 22, height: 22 }}
                        onClick={() => copyUrl(l)}
                      >
                        <Icon name={copied === l.id ? "check" : "copy"} size={12} />
                      </button>
                    </div>
                  </td>
                  <td style={{ maxWidth: 260 }}>
                    <span
                      className="muted"
                      title={l.destination}
                      style={{ fontSize: 12.5, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {l.destination}
                    </span>
                  </td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{l.campaignName ?? "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{l.clicks}</td>
                  <td style={{ textAlign: "center" }}>{statusBadge(l)}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{fullLabel(new Date(l.createdAt))}</td>
                  <td>
                    <div className="row gap8" style={{ justifyContent: "flex-end" }}>
                      <button className="icon-btn" title="QR Code" onClick={() => setQrFor(l)}>
                        <Icon name="qr" size={15} />
                      </button>
                      <button className="icon-btn" title="Editar" onClick={() => setFormFor(l)}>
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        title={l.active ? "Desativar" : "Reativar"}
                        disabled={pending}
                        onClick={() => run(() => toggleLinkAction(l.id))}
                      >
                        <Icon name={l.active ? "pause" : "play"} size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Excluir"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`Excluir o link "${l.title || l.slug}" e todo o seu histórico de cliques?`)) {
                            run(() => deleteLinkAction(l.id));
                          }
                        }}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {formFor && (
        <LinkFormModal
          shortBase={shortBase}
          campaigns={campaigns}
          link={formFor === "new" ? null : formFor}
          onClose={() => setFormFor(null)}
          onSaved={() => {
            setFormFor(null);
            router.refresh();
          }}
        />
      )}
      {qrFor && <QrModal link={qrFor} onClose={() => setQrFor(null)} />}
    </>
  );
}
