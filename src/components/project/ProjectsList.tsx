"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProjectCard } from "./ProjectCard";
import { chaveCategoria, limparCategoria } from "@/lib/categoria";
import { STATUS_META, PROJETOS_CONCLUIDOS_QUADRO } from "@/lib/meta";
import type { ProjectListItem } from "@/server/projects";
import type { ProjectStatus } from "@/lib/types";
import styles from "./ProjectsList.module.css";

const COLUMNS: ProjectStatus[] = ["planned", "progress", "review", "done"];

export function ProjectsList({ projects }: { projects: ProjectListItem[] }) {
  const [cat, setCat] = useState(""); // "" = todas
  const [q, setQ] = useState("");
  const [verTodosConcluidos, setVerTodosConcluidos] = useState(false);

  const query = q.trim().toLocaleLowerCase("pt-BR");

  // Busca primeiro, categoria depois: os chips contam sobre o resultado da
  // busca, senão o número do chip contradiz o que está nas colunas.
  const buscados = query
    ? projects.filter((p) => `${p.name} ${p.client}`.toLocaleLowerCase("pt-BR").includes(query))
    : projects;

  const categorias = contarCategorias(buscados, cat);
  const list = cat ? buscados.filter((p) => chaveCategoria(p.tag) === chaveCategoria(cat)) : buscados;

  return (
    <>
      <div className={styles.filters}>
        {categorias.length > 0 && (
          <div className={styles.categoryBar}>
            <span className={styles.filterLabel}>Categoria</span>
            <div className={`seg ${styles.categorySegments}`}>
              <button className={cat ? "" : "on"} onClick={() => setCat("")} aria-pressed={!cat}>
                Todas
              </button>
              {categorias.map((c) => {
                const on = chaveCategoria(cat) === chaveCategoria(c.nome);
                return (
                  <button key={c.nome} className={on ? "on" : ""} onClick={() => setCat(on ? "" : c.nome)} aria-pressed={on}>
                    <span className={styles.categoryName}>{c.nome}</span>
                    <span className={styles.categoryCount}>{c.total}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <label className={`search ${styles.search}`}>
          <Icon name="search" size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar projeto…"
            aria-label="Buscar projeto"
            style={{ border: "none", outline: "none", background: "transparent", font: "inherit", color: "var(--ink)", width: "100%" }}
          />
        </label>
      </div>

      <div className={styles.boardViewport}>
        <div className={styles.board} role="group" aria-label="Quadro Kanban de projetos">
          {COLUMNS.map((status) => {
            const meta = STATUS_META[status];
            const concluidos = status === "done";
            // Projeto encerrado é histórico: sem teto a coluna cresce pra sempre
            // e, como a lista vem do mais antigo pro mais novo, o que acabou
            // ontem fica no fim. Inverte e corta.
            const items = concluidos
              ? list.filter((p) => p.status === "done").reverse()
              : list.filter((p) => p.status === status);
            const ocultos =
              concluidos && !verTodosConcluidos ? Math.max(0, items.length - PROJETOS_CONCLUIDOS_QUADRO) : 0;
            const visiveis = ocultos > 0 ? items.slice(0, PROJETOS_CONCLUIDOS_QUADRO) : items;

            return (
              <section key={status} className={styles.column} aria-labelledby={`project-column-${status}`}>
                <div className={styles.columnHeader}>
                  <div className={styles.columnTitle}>
                    <span className={styles.statusDot} style={{ background: meta.c }} />
                    <h2 id={`project-column-${status}`}>{meta.label}</h2>
                  </div>
                  <span className={styles.columnCount}>
                    {items.length}
                    <span className={styles.srOnly}> {items.length === 1 ? "projeto" : "projetos"}</span>
                  </span>
                </div>

                <div className={styles.columnBody}>
                  {items.length > 0 ? (
                    visiveis.map((p) => <ProjectCard key={p.id} p={p} />)
                  ) : (
                    <div className={styles.columnEmpty}>
                      {query || cat ? "Nenhum resultado." : "Nenhum projeto neste estágio."}
                    </div>
                  )}

                  {ocultos > 0 && (
                    <button type="button" className={styles.showMore} onClick={() => setVerTodosConcluidos(true)}>
                      Ver mais {ocultos} {ocultos === 1 ? "concluído" : "concluídos"}
                    </button>
                  )}
                  {concluidos && verTodosConcluidos && items.length > PROJETOS_CONCLUIDOS_QUADRO && (
                    <button type="button" className={styles.showMore} onClick={() => setVerTodosConcluidos(false)}>
                      Mostrar menos
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
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
