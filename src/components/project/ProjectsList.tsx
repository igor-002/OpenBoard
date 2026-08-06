"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProjectCard } from "./ProjectCard";
import { chaveCategoria, limparCategoria } from "@/lib/categoria";
import type { ProjectListItem } from "@/server/projects";
import type { ProjectStatus } from "@/lib/types";

const TABS: [ProjectStatus | "all", string][] = [
  ["all", "Ativos"],
  ["progress", "Em andamento"],
  ["review", "Em revisão"],
  ["planned", "Planejados"],
  ["done", "Concluídos"],
];

export function ProjectsList({ projects }: { projects: ProjectListItem[] }) {
  const [filter, setFilter] = useState<ProjectStatus | "all">("all");
  const [cat, setCat] = useState(""); // "" = todas
  const [q, setQ] = useState("");

  // "Ativos" esconde concluído: projeto encerrado só na aba Concluídos, senão
  // a lista vira histórico e o que está em aberto some no meio.
  const doStatus = projects.filter((p) => (filter === "all" ? p.status !== "done" : p.status === filter));

  // As categorias saem do que está VISÍVEL na aba, não do workspace inteiro —
  // senão a aba "Ativos" mostrava "Atendai Provedor 1" e clicar não trazia
  // nada, porque o único projeto dessa categoria estava concluído.
  const categorias = contarCategorias(doStatus, cat);

  const list = doStatus.filter((p) => {
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

      {categorias.length > 0 && (
        <div className="row gap8" style={{ marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Categoria</span>
          <div className="seg" style={{ flexWrap: "wrap" }}>
            <button className={cat ? "" : "on"} onClick={() => setCat("")}>Todas</button>
            {categorias.map((c) => {
              const on = chaveCategoria(cat) === chaveCategoria(c.nome);
              return (
                <button key={c.nome} className={on ? "on" : ""} onClick={() => setCat(on ? "" : c.nome)}>
                  {c.nome}
                  <span style={{ marginLeft: 6, opacity: 0.6 }}>{c.total}</span>
                </button>
              );
            })}
          </div>
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

// Conta por categoria unificando caixa/espaço; nome exibido = variante mais
// usada. A selecionada entra mesmo zerada, pra não sumir o chip debaixo do
// clique ao trocar de aba.
function contarCategorias(projects: ProjectListItem[], selecionada: string): { nome: string; total: number }[] {
  const mapa = new Map<string, { nome: string; total: number; maior: number }>();
  const somar = (tag: string, n: number) => {
    const nome = limparCategoria(tag);
    if (!nome) return;
    const k = chaveCategoria(nome);
    const atual = mapa.get(k);
    if (!atual) mapa.set(k, { nome, total: n, maior: n });
    else {
      atual.total += n;
      if (n > atual.maior || (n === atual.maior && nome.localeCompare(atual.nome) < 0)) {
        atual.nome = nome;
        atual.maior = n;
      }
    }
  };

  for (const p of projects) somar(p.tag, 1);
  if (selecionada && !mapa.has(chaveCategoria(selecionada))) somar(selecionada, 0);

  return [...mapa.values()]
    .map(({ nome, total }) => ({ nome, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}
