"use client";

// Lista de demandas: filtros (via querystring) e tabela. Clicar numa linha abre
// o painel de detalhe (PainelDemanda), que vive no shell.
import { useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { NovaDemandaModal } from "@/components/demanda/NovaDemandaModal";
import { useAbrirDemanda } from "@/components/demanda/PainelDemanda";
import { ORIGEM_META, ORIGENS, PRIORITY_META, STATUS_DEMANDA, isAberta, isAtrasada } from "@/lib/meta";
import { minLabel } from "@/lib/format";
import type { AtividadesData, AtividadeRow } from "@/server/atividades";
import type { TaskColumn } from "@/lib/types";

function fmtDay(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

const FILTROS_EXTRA = ["tipo", "origem", "cliente", "from", "to"];

export function AtividadesView({ data }: { data: AtividadesData }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const abrir = useAbrirDemanda();
  const [creating, setCreating] = useState(false);
  const extrasAtivos = FILTROS_EXTRA.filter((k) => sp.get(k)).length;
  const [maisFiltros, setMaisFiltros] = useState(extrasAtivos > 0);

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp],
  );

  const status = sp.get("status") ?? "";
  const temFiltro = !!(status || sp.get("assignee") || extrasAtivos);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Demandas</h1>
          <p className="page-sub">
            {data.rows.length === data.limite ? `Mostrando as ${data.limite} mais recentes` : `${data.rows.length} ${data.rows.length === 1 ? "demanda" : "demandas"}`}
            {status === "" ? " em aberto" : status === "todas" ? ", de todos os status" : ` com status ${STATUS_DEMANDA[status as TaskColumn]?.label.toLowerCase() ?? ""}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} />
          Nova demanda
        </button>
      </div>

      <div className="dl-filtros">
        <select className="hj-select" value={status} onChange={(e) => setFilter("status", e.target.value)} aria-label="Status">
          <option value="">Em aberto</option>
          {(Object.keys(STATUS_DEMANDA) as TaskColumn[]).map((c) => (
            <option key={c} value={c}>
              {STATUS_DEMANDA[c].label}
            </option>
          ))}
          <option value="todas">Todas</option>
        </select>
        <select className="hj-select" value={sp.get("assignee") ?? ""} onChange={(e) => setFilter("assignee", e.target.value)} aria-label="Responsável">
          <option value="">Todos os responsáveis</option>
          <option value="nenhum">Sem dono</option>
          {data.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button className="hj-flag" aria-pressed={maisFiltros} aria-expanded={maisFiltros} onClick={() => setMaisFiltros((v) => !v)}>
          <Icon name="filter" size={14} />
          Filtros{extrasAtivos > 0 ? ` · ${extrasAtivos}` : ""}
        </button>
        {temFiltro && (
          <button className="dm-link" onClick={() => router.replace(pathname)}>
            Limpar filtros
          </button>
        )}

        {maisFiltros && (
          <div className="dl-filtros-extra">
            <select className="hj-select" value={sp.get("tipo") ?? ""} onChange={(e) => setFilter("tipo", e.target.value)} aria-label="Tipo">
              <option value="">Todos os tipos</option>
              {data.tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select className="hj-select" value={sp.get("origem") ?? ""} onChange={(e) => setFilter("origem", e.target.value)} aria-label="Chegou por">
              <option value="">Todos os canais</option>
              {ORIGENS.map((o) => (
                <option key={o} value={o}>
                  {ORIGEM_META[o].label}
                </option>
              ))}
            </select>
            <select className="hj-select" value={sp.get("cliente") ?? ""} onChange={(e) => setFilter("cliente", e.target.value)} aria-label="Cliente">
              <option value="">Todos os clientes</option>
              {data.clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razao}
                </option>
              ))}
            </select>
            <label className="dl-data">
              Abertas de
              <input className="hj-select" type="date" value={sp.get("from") ?? ""} onChange={(e) => setFilter("from", e.target.value)} />
            </label>
            <label className="dl-data">
              até
              <input className="hj-select" type="date" value={sp.get("to") ?? ""} onChange={(e) => setFilter("to", e.target.value)} />
            </label>
          </div>
        )}
      </div>

      <div className="dl-tabela">
        <table>
          <thead>
            <tr>
              <th style={{ width: 64 }}>Nº</th>
              <th>Demanda</th>
              <th>Quem pediu</th>
              <th>Responsável</th>
              <th>Status</th>
              <th>Aberta</th>
              <th>Tempo</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="dl-vazio">
                  {temFiltro ? "Nenhuma demanda com esses filtros." : "Nenhuma demanda em aberto. O que aparecer, registre em Nova demanda."}
                </td>
              </tr>
            )}
            {data.rows.map((r) => (
              <Row key={r.id} r={r} onOpen={() => abrir(r.numero)} />
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <NovaDemandaModal
          tipos={data.tipos}
          members={data.members}
          projects={data.projects}
          onClose={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function Row({ r, onOpen }: { r: AtividadeRow; onOpen: () => void }) {
  const om = ORIGEM_META[r.origem];
  const st = STATUS_DEMANDA[r.column];
  const atrasada = isAtrasada(r.column, r.dueDate);
  return (
    <tr onClick={onOpen} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <td className="dl-num">#{r.numero}</td>
      <td>
        <div className="dl-titulo">{r.title}</div>
        <div className="hj-linha-meta">
          {r.priority === "high" && <span className="hj-chip cor-vermelho">{PRIORITY_META.high.label}</span>}
          <span className="hj-chip" style={{ color: om.c, background: om.bg }}>
            {om.label}
          </span>
          {r.tipoName && <span>{r.tipoName}</span>}
          {r.projectName && <span>{r.projectName}</span>}
          {r.acompanhamentos > 0 && (
            <span className="row" style={{ gap: 3 }}>
              <Icon name="msg" size={12} /> {r.acompanhamentos}
            </span>
          )}
        </div>
      </td>
      <td>
        {r.solicitante ?? r.clienteRazao ?? <span className="muted">—</span>}
        {r.solicitante && r.clienteRazao && <div className="dl-sub">{r.clienteRazao}</div>}
      </td>
      <td>
        {r.assignee ? (
          <span className="row gap8">
            <Avatar user={r.assignee} size={24} ring={false} />
            <span style={{ textTransform: "capitalize" }}>{r.assignee.name?.split(" ")[0]}</span>
          </span>
        ) : (
          <span className="hj-chip cor-laranja">Sem dono</span>
        )}
      </td>
      <td>
        <span className="hj-pilula" style={{ color: st.c, background: st.bg }}>
          <i />
          {st.label}
        </span>
      </td>
      <td>
        {fmtDay(r.createdAt)}
        {r.dueDate && (
          <div className="dl-sub" style={atrasada ? { color: "var(--vermelho)", fontWeight: 600 } : undefined}>
            prazo {fmtDay(r.dueDate)}
          </div>
        )}
      </td>
      <td>
        {r.realMinutes != null ? (
          <b>{minLabel(r.realMinutes)}</b>
        ) : r.startedAt && isAberta(r.column) ? (
          <span className="muted">em curso</span>
        ) : (
          <span className="muted">—</span>
        )}
        {r.estimatedMinutes != null && <div className="dl-sub">est. {minLabel(r.estimatedMinutes)}</div>}
      </td>
    </tr>
  );
}
