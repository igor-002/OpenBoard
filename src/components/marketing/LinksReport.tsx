"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Stat";
import { LineChart } from "@/components/charts/Charts";
import { SocialDonutCard, BarsList } from "./SocialCharts";
import { BrazilMap, type MapPoint } from "./BrazilMap";
import { projectPoint } from "./BrazilMapData";

// Relatório gerencial dos links curtos. Layout na linha do Dub (grid de cards
// de barras + série temporal no topo) com o recorte do Bitly (QR/direto vs
// cliques vindos de rede) e toggle de nível geográfico à la Plausible.

type Item = { label: string; value: number };

interface Report {
  campaigns: { id: string; name: string }[];
  stats: { total: number; uniques: number; qrDirect: number; withOrigin: number; activeLinks: number };
  daily: { day: string; label: string; count: number }[];
  byOrigin: Item[];
  byCampaign: Item[];
  byDevice: Item[];
  byRegion: Item[];
  byCity: Item[];
  mapPoints: MapPoint[];
  topLinks: { id: string; title: string; slug: string; kind: string; campaignName: string | null; clicks: number }[];
}

const PERIODS: { days: number; label: string }[] = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 0, label: "Tudo" },
];

const DEVICE_LABEL: Record<string, string> = {
  mobile: "Celular",
  tablet: "Tablet",
  desktop: "Desktop",
};

export function LinksReport({
  dias,
  campaignId,
  report,
}: {
  dias: number;
  campaignId: string | null;
  report: Report;
}) {
  const router = useRouter();
  const [geoMode, setGeoMode] = useState<"region" | "city">("region");

  function navigate(nextDias: number, nextCampaign: string | null) {
    const params = new URLSearchParams();
    if (nextDias !== 30) params.set("dias", String(nextDias));
    if (nextCampaign) params.set("campanha", nextCampaign);
    const qs = params.toString();
    router.push(`/marketing/links/relatorios${qs ? `?${qs}` : ""}`);
  }

  const { stats } = report;
  const geoItems = geoMode === "region" ? report.byRegion : report.byCity;
  const periodLabel = PERIODS.find((p) => p.days === dias)?.label ?? "";
  const outsideMap = report.mapPoints
    .filter((p) => !projectPoint(p.lat, p.lon))
    .reduce((s, p) => s + p.count, 0);

  return (
    <>
      <div className="row gap12" style={{ alignItems: "center", marginBottom: "var(--gap)", flexWrap: "wrap" }}>
        <div className="row gap8">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              className={`btn ${p.days === dias ? "btn-primary" : "btn-ghost"}`}
              style={{ padding: "4px 12px", fontSize: 12.5 }}
              onClick={() => navigate(p.days, campaignId)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={campaignId ?? ""}
          onChange={(e) => navigate(dias, e.target.value || null)}
          className="input"
          style={{ maxWidth: 240 }}
        >
          <option value="">Todas as campanhas</option>
          {report.campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Link href="/marketing/links" className="btn btn-ghost" style={{ marginLeft: "auto" }}>
          <Icon name="link" size={15} /> Gerenciar links
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <StatCard icon="qr" label="Cliques" value={stats.total} foot={periodLabel} />
        <StatCard icon="users" label="Visitantes únicos" value={stats.uniques} accent="var(--c3)" foot="por IP (hash)" />
        <StatCard icon="target" label="QR / direto" value={stats.qrDirect} accent="var(--c5)" foot="scan de QR ou link digitado" />
        <StatCard icon="share" label="Via redes / sites" value={stats.withOrigin} accent="var(--c4)" foot="clique com origem identificada" />
        <StatCard icon="link" label="Links com clique" value={stats.activeLinks} accent="var(--c2)" foot={periodLabel} />
      </div>

      <Card title="Cliques por dia" sub={dias === 0 ? "Últimos 90 dias (janela do gráfico)" : periodLabel} pad style={{ marginBottom: "var(--gap)" }}>
        {report.daily.every((d) => d.count === 0) ? (
          <div className="muted" style={{ padding: 20, textAlign: "center" }}>Nenhum clique no período.</div>
        ) : (
          <>
            <LineChart data={report.daily.map((d) => d.count)} h={200} />
            <div className="row" style={{ marginTop: 8 }}>
              {report.daily.map((d, i) => {
                const step = Math.max(1, Math.round(report.daily.length / 8));
                return (
                  <span key={d.day} style={{ flex: 1, fontSize: 10, color: "var(--muted)", textAlign: "center" }}>
                    {i % step === 0 ? d.label : ""}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <Card title="Origem do clique" sub="Referrer classificado — scan de QR não manda origem" pad>
          {report.byOrigin.length === 0 ? (
            <div className="muted" style={{ padding: 20, textAlign: "center" }}>Sem dados no período.</div>
          ) : (
            <BarsList items={report.byOrigin.slice(0, 8)} />
          )}
        </Card>
        <Card title="Campanhas" sub="Cliques por campanha no período" pad>
          {report.byCampaign.length === 0 ? (
            <div className="muted" style={{ padding: 20, textAlign: "center" }}>Sem dados no período.</div>
          ) : (
            <BarsList items={report.byCampaign.slice(0, 8)} />
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <SocialDonutCard
          title="Dispositivos"
          sub={periodLabel}
          items={report.byDevice.map((d) => ({ label: DEVICE_LABEL[d.label] ?? d.label, value: d.value }))}
        />
        <Card
          title="Localização"
          sub="Via IP (aproximada)"
          pad
          action={
            <div className="row gap8">
              <button
                className={`btn ${geoMode === "region" ? "btn-primary" : "btn-ghost"}`}
                style={{ padding: "2px 10px", fontSize: 12 }}
                onClick={() => setGeoMode("region")}
              >
                Estado
              </button>
              <button
                className={`btn ${geoMode === "city" ? "btn-primary" : "btn-ghost"}`}
                style={{ padding: "2px 10px", fontSize: 12 }}
                onClick={() => setGeoMode("city")}
              >
                Cidade
              </button>
            </div>
          }
        >
          {geoItems.length === 0 ? (
            <div className="muted" style={{ padding: 20, textAlign: "center" }}>
              Sem geolocalização no período.
            </div>
          ) : (
            <>
              {report.mapPoints.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <BrazilMap points={report.mapPoints} height={280} />
                  {outsideMap > 0 && (
                    <p className="muted" style={{ fontSize: 11.5, marginTop: 4, textAlign: "center" }}>
                      +{outsideMap} clique(s) fora do Brasil (não plotados no mapa)
                    </p>
                  )}
                </div>
              )}
              <BarsList items={geoItems.slice(0, 8)} />
            </>
          )}
        </Card>
      </div>

      <Card title="Links mais clicados" sub={periodLabel} pad={false}>
        {report.topLinks.length === 0 ? (
          <div className="muted" style={{ padding: 24, textAlign: "center" }}>Nenhum clique no período.</div>
        ) : (
          <table className="tbl" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>#</th>
                <th style={{ textAlign: "left" }}>Link</th>
                <th style={{ textAlign: "left" }}>Campanha</th>
                <th style={{ textAlign: "right" }}>Cliques</th>
              </tr>
            </thead>
            <tbody>
              {report.topLinks.map((l, i) => (
                <tr key={l.id}>
                  <td className="muted" style={{ width: 32 }}>{i + 1}</td>
                  <td>
                    <Link href={`/marketing/links/${l.id}`} style={{ fontWeight: 700 }}>{l.title}</Link>
                    <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>/r/{l.slug}</span>
                    {l.kind === "whatsapp" && (
                      <span className="badge" style={{ marginLeft: 8, color: "var(--st-done)", background: "var(--st-done-bg)" }}>WhatsApp</span>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{l.campaignName ?? "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{l.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
