"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProjectCard } from "./ProjectCard";
import { chaveCategoria, corCategoria } from "@/lib/categoria";
import type { ProjectListItem } from "@/server/projects";
import type { ProjectStatus } from "@/lib/types";

const TABS: [ProjectStatus | "all", string][] = [
  ["all", "Ativos"],
  ["progress", "Em andamento"],
  ["review", "Em revisão"],
  ["planned", "Planejados"],
  ["done", "Concluídos"],
];

export function ProjectsList({
  projects,
  categorias,
}: {
  projects: ProjectListItem[];
  categorias: { nome: string; total: number }[];
}) {
  const [filter, setFilter] = useState<ProjectStatus | "all">("all");
  const [cat, setCat] = useState(""); // "" = todas
  const [q, setQ] = useState("");

  const list = projects.filter((p) => {
    // "Ativos" esconde concluído: projeto encerrado só na aba Concluídos, senão
    // a lista vira histórico e o que está em aberto some no meio.
    if (filter === "all" ? p.status === "done" : p.status !== filter) return false;
    if (cat && chaveCategoria(p.tag) !== chaveCategoria(cat)) return false;
    if (q && !`${p.name} ${p.client}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div className="row between" style={{ marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div className="seg">
          {TABS.map(([k, l]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="search" style={{ width: 240 }}>
          <Icon name="search" size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar projeto…"
            style={{ border: "none", outline: "none", background: "transparent", font: "inherit", color: "var(--ink)", width: "100%" }}
          />
        </div>
      </div>

      {/* Filtro por categoria — cada uma com a cor que também aparece no card. */}
      {categorias.length > 0 && (
        <div className="row gap8" style={{ marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className="tag"
            onClick={() => setCat("")}
            style={{
              cursor: "pointer",
              background: cat ? "var(--surface-3)" : "var(--ink)",
              color: cat ? "var(--ink-2)" : "#fff",
              borderColor: cat ? "var(--line)" : "var(--ink)",
            }}
          >
            Todas
          </button>
          {categorias.map((c) => {
            const cor = corCategoria(c.nome);
            const on = chaveCategoria(cat) === chaveCategoria(c.nome);
            return (
              <button
                key={c.nome}
                className="tag"
                onClick={() => setCat(on ? "" : c.nome)}
                title={`${c.total} projeto${c.total > 1 ? "s" : ""}`}
                style={{
                  cursor: "pointer",
                  background: on ? cor.fg : cor.bg,
                  color: on ? "#fff" : cor.fg,
                  borderColor: on ? cor.fg : "transparent",
                }}
              >
                {c.nome}
                <span style={{ marginLeft: 6, opacity: 0.7, fontWeight: 700 }}>{c.total}</span>
              </button>
            );
          })}
        </div>
      )}

      {list.length === 0 ? (
        <div className="card card-pad muted" style={{ textAlign: "center", padding: 48 }}>
          Nenhum projeto encontrado.
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {list.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </>
  );
}
