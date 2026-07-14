"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Stat";
import { LineChart } from "@/components/charts/Charts";
import { SocialDonutCard, BarsList } from "./SocialCharts";
import { fullLabel } from "@/lib/format";

interface DetailLink {
  id: string;
  slug: string;
  shortUrl: string;
  destination: string;
  title: string;
  kind: string;
  active: boolean;
  expired: boolean;
  campaignName: string | null;
  tags: string;
  createdAt: string;
}

interface RecentClick {
  id: number;
  at: string;
  city: string | null;
  region: string | null;
  country: string | null;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
  referrer: string | null;
  isBot: boolean;
}

const DEVICE_LABEL: Record<string, string> = {
  mobile: "Celular",
  tablet: "Tablet",
  desktop: "Desktop",
};

export function LinkDetail({
  link,
  stats,
  daily,
  byDevice,
  byRegion,
  byCountry,
  recent,
}: {
  link: DetailLink;
  stats: { total: number; last7: number; botCount: number };
  daily: { day: string; label: string; count: number }[];
  byDevice: { label: string; value: number }[];
  byRegion: { label: string; value: number }[];
  byCountry: { label: string; value: number }[];
  recent: RecentClick[];
}) {
  const [geoMode, setGeoMode] = useState<"region" | "country">("region");
  const [copied, setCopied] = useState(false);

  const topDevice = byDevice[0];
  const topPlace = byRegion[0] ?? byCountry[0];
  const geoItems = geoMode === "region" ? byRegion : byCountry;

  function copyUrl() {
    navigator.clipboard.writeText(link.shortUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="row gap8" style={{ alignItems: "center", marginBottom: 4 }}>
            <Link href="/marketing/links" className="icon-btn" title="Voltar">
              <Icon name="chevLeft" size={16} />
            </Link>
            <h1 className="page-title" style={{ margin: 0 }}>{link.title || link.slug}</h1>
            {link.kind === "whatsapp" && (
              <span className="badge" style={{ color: "var(--st-done)", background: "var(--st-done-bg)" }}>WhatsApp</span>
            )}
            {(!link.active || link.expired) && (
              <span className="badge" style={{ color: "var(--st-risk)", background: "var(--st-risk-bg)" }}>
                {!link.active ? "inativo" : "expirado"}
              </span>
            )}
          </div>
          <p className="page-sub row gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ wordBreak: "break-all" }}>{link.shortUrl}</b>
            <button className="icon-btn" title={copied ? "Copiado!" : "Copiar"} style={{ width: 22, height: 22 }} onClick={copyUrl}>
              <Icon name={copied ? "check" : "copy"} size={12} />
            </button>
            <span className="muted">→</span>
            <a href={link.destination} target="_blank" rel="noreferrer" className="muted" style={{ wordBreak: "break-all" }}>
              {link.destination} <Icon name="externalLink" size={11} />
            </a>
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <StatCard icon="qr" label="Total de cliques" value={stats.total} foot={`desde ${fullLabel(new Date(link.createdAt))}`} />
        <StatCard icon="trendUp" label="Últimos 7 dias" value={stats.last7} accent="var(--c3)" foot="cliques reais (sem bots)" />
        <StatCard
          icon="users"
          label="Dispositivo principal"
          value={topDevice ? (DEVICE_LABEL[topDevice.label] ?? topDevice.label) : "—"}
          accent="var(--c5)"
          foot={topDevice ? `${topDevice.value} clique(s)` : "sem dados"}
        />
        <StatCard
          icon="flag"
          label="Local principal"
          value={topPlace?.label ?? "—"}
          accent="var(--c4)"
          foot={topPlace ? `${topPlace.value} clique(s)` : "sem geolocalização ainda"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <Card title="Cliques ao longo do tempo" sub="Últimos 30 dias" pad>
          {daily.every((d) => d.count === 0) ? (
            <div className="muted" style={{ padding: 20, textAlign: "center" }}>Nenhum clique no período.</div>
          ) : (
            <>
              <LineChart data={daily.map((d) => d.count)} h={180} />
              <div className="row" style={{ marginTop: 8 }}>
                {daily.map((d, i) => (
                  <span key={d.day} style={{ flex: 1, fontSize: 10, color: "var(--muted)", textAlign: "center" }}>
                    {i % 5 === 0 ? d.label : ""}
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>
        <SocialDonutCard
          title="Dispositivos"
          items={byDevice.map((d) => ({ label: DEVICE_LABEL[d.label] ?? d.label, value: d.value }))}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <Card
          title="Distribuição geográfica"
          sub="Via IP (aproximada)"
          pad
          action={
            <div className="row gap8">
              <button className={`btn ${geoMode === "region" ? "btn-primary" : "btn-ghost"}`} style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => setGeoMode("region")}>
                Estado
              </button>
              <button className={`btn ${geoMode === "country" ? "btn-primary" : "btn-ghost"}`} style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => setGeoMode("country")}>
                País
              </button>
            </div>
          }
        >
          {geoItems.length === 0 ? (
            <div className="muted" style={{ padding: 20, textAlign: "center" }}>
              Sem geolocalização ainda (IPs locais/privados não são localizados).
            </div>
          ) : (
            <BarsList items={geoItems.slice(0, 8)} />
          )}
        </Card>
        <Card title="Últimos acessos" sub={stats.botCount > 0 ? `${stats.botCount} acesso(s) de bot marcados` : undefined} pad={false}>
          {recent.length === 0 ? (
            <div className="muted" style={{ padding: 24, textAlign: "center" }}>Nenhum acesso registrado.</div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              <table className="tbl" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Quando</th>
                    <th style={{ textAlign: "left" }}>Onde</th>
                    <th style={{ textAlign: "left" }}>Dispositivo</th>
                    <th style={{ textAlign: "left" }}>Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((c) => (
                    <tr key={c.id} style={c.isBot ? { opacity: 0.5 } : undefined}>
                      <td className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        {fullLabel(new Date(c.at))}
                        {c.isBot && <span className="badge" style={{ marginLeft: 6 }}>bot</span>}
                      </td>
                      <td style={{ fontSize: 12.5 }}>
                        {c.city ? `${c.city}${c.region ? ` – ${c.region}` : ""}` : (c.country ?? "—")}
                      </td>
                      <td className="muted" style={{ fontSize: 12 }}>
                        {[c.deviceType ? (DEVICE_LABEL[c.deviceType] ?? c.deviceType) : null, c.os, c.browser]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="muted" style={{ fontSize: 12, maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={c.referrer ?? undefined}>
                        {c.referrer ?? "direto"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
