"use client";

// Registro de atividades da equipe: stats, filtros (via querystring) e tabela.
import { useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { PriorityBadge } from "@/components/ui/Badge";
import { KANBAN_COLS, ORIGEM_META } from "@/lib/meta";
import { NovaAtividadeModal } from "./NovaAtividadeModal";
import { AtividadeDetailModal } from "./AtividadeDetailModal";
import type { AtividadesData, AtividadeRow } from "@/server/atividades";
import type { AvatarUser, TaskOrigin } from "@/lib/types";

type CurrentUser = AvatarUser & { id: string };

function fmtDay(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function fmtMin(min: number) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function AtividadesView({ data, currentUser, isAdmin }: { data: AtividadesData; currentUser: CurrentUser; isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp]
  );

  const opened = openId ? data.rows.find((r) => r.id === openId) ?? null : null;
  const hasFilters = ["assignee", "tipo", "origem", "status", "cliente", "from", "to"].some((k) => sp.get(k));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Atividades da equipe</h1>
          <p className="page-sub">Registre demandas avulsas e presenciais, acompanhe execução e histórico</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} />
          Nova atividade
        </button>
      </div>

      {/* Stats */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
        <StatCard label="Abertas" value={data.stats.abertas} icon="circle" />
        <StatCard label="Em andamento" value={data.stats.emAndamento} icon="play" />
        <StatCard label="Concluídas no mês" value={data.stats.concluidasMes} icon="checkCircle" />
        <StatCard label="Avulsas/presenciais no mês" value={data.stats.avulsasMes} icon="zap" />
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div className="row gap12" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <FilterSelect label="Responsável" value={sp.get("assignee") ?? ""} onChange={(v) => setFilter("assignee", v)} options={data.members.map((m) => [m.id, m.name])} all="Todos" />
          <FilterSelect label="Tipo" value={sp.get("tipo") ?? ""} onChange={(v) => setFilter("tipo", v)} options={data.tipos.map((t) => [t.id, t.name])} all="Todos" />
          <FilterSelect label="Origem" value={sp.get("origem") ?? ""} onChange={(v) => setFilter("origem", v)} options={(Object.keys(ORIGEM_META) as TaskOrigin[]).map((o) => [o, ORIGEM_META[o].label])} all="Todas" />
          <FilterSelect label="Status" value={sp.get("status") ?? ""} onChange={(v) => setFilter("status", v)} options={KANBAN_COLS.map((c) => [c.id, c.label])} all="Todos" />
          <FilterSelect label="Cliente" value={sp.get("cliente") ?? ""} onChange={(v) => setFilter("cliente", v)} options={data.clientes.map((c) => [c.id, c.razao])} all="Todos" />
          <div className="field" style={{ width: 150 }}>
            <label>De</label>
            <input className="input" type="date" value={sp.get("from") ?? ""} onChange={(e) => setFilter("from", e.target.value)} />
          </div>
          <div className="field" style={{ width: 150 }}>
            <label>Até</label>
            <input className="input" type="date" value={sp.get("to") ?? ""} onChange={(e) => setFilter("to", e.target.value)} />
          </div>
          {hasFilters && (
            <button className="btn" style={{ marginBottom: 2 }} onClick={() => router.replace(pathname)}>
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left" }}>
              {["Atividade", "Tipo", "Origem", "Cliente", "Responsável", "Status", "Prior.", "Criada", "Tempo (est/real)"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>
                  Nenhuma atividade encontrada.
                </td>
              </tr>
            )}
            {data.rows.map((r) => (
              <Row key={r.id} r={r} onOpen={() => setOpenId(r.id)} />
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <NovaAtividadeModal
          tipos={data.tipos}
          members={data.members}
          projects={data.projects}
          currentUserId={currentUser.id}
          onClose={() => { setCreating(false); router.refresh(); }}
        />
      )}
      {opened && (
        <AtividadeDetailModal
          atividade={opened}
          currentUser={currentUser}
          isAdmin={isAdmin}
          onClose={() => { setOpenId(null); router.refresh(); }}
        />
      )}
    </>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: "circle" | "play" | "checkCircle" | "zap" }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row gap8" style={{ color: "var(--muted)", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
        <Icon name={icon} size={15} />
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, all }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; all: string }) {
  return (
    <div className="field" style={{ minWidth: 140 }}>
      <label>{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </select>
    </div>
  );
}

function Row({ r, onOpen }: { r: AtividadeRow; onOpen: () => void }) {
  const om = ORIGEM_META[r.origem];
  const col = KANBAN_COLS.find((c) => c.id === r.column);
  const overdue = r.dueDate && r.column !== "done" && new Date(r.dueDate) < new Date();
  return (
    <tr
      onClick={onOpen}
      style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
    >
      <td style={{ padding: "11px 14px", fontWeight: 600, maxWidth: 280 }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
        {r.projectName && <div className="muted" style={{ fontSize: 11.5 }}>{r.projectName}</div>}
        {r.comments.length > 0 && (
          <span className="muted" style={{ fontSize: 11.5 }}>
            <Icon name="msg" size={11} /> {r.comments.length} {r.comments.length > 1 ? "atualizações" : "atualização"}
          </span>
        )}
      </td>
      <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>{r.tipoName ?? "—"}</td>
      <td style={{ padding: "11px 14px" }}>
        <span className="badge" style={{ color: om.c, background: om.bg }}>{om.label}</span>
      </td>
      <td style={{ padding: "11px 14px", maxWidth: 180 }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.clienteRazao ?? "—"}</div>
      </td>
      <td style={{ padding: "11px 14px" }}>
        {r.assignee ? (
          <span className="row gap8" style={{ whiteSpace: "nowrap" }}>
            <Avatar user={r.assignee} size={24} />
            <span style={{ fontSize: 12.5 }}>{r.assignee.name}</span>
          </span>
        ) : (
          "—"
        )}
      </td>
      <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
        {col && (
          <span className="badge" style={{ color: col.c, background: "var(--surface-3)" }}>
            <span className="bdot" style={{ background: col.c }} />
            {col.label}
          </span>
        )}
      </td>
      <td style={{ padding: "11px 14px" }}>
        <PriorityBadge pr={r.priority} />
      </td>
      <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: overdue ? "var(--st-risk)" : undefined }}>
        {fmtDay(r.createdAt)}
        {r.dueDate && <div className="muted" style={{ fontSize: 11.5, color: overdue ? "var(--st-risk)" : undefined }}>prazo {fmtDay(r.dueDate)}</div>}
      </td>
      <td style={{ padding: "11px 14px", whiteSpace: "nowrap", fontSize: 12.5 }}>
        {r.estimatedMinutes ? fmtMin(r.estimatedMinutes) : "—"}
        {" / "}
        {r.realMinutes != null ? <b>{fmtMin(r.realMinutes)}</b> : r.startedAt && r.column !== "done" ? <span className="muted">em curso</span> : "—"}
      </td>
    </tr>
  );
}
