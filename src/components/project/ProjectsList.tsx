"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProjectCard } from "./ProjectCard";
import type { ProjectListItem } from "@/server/projects";
import type { ProjectStatus } from "@/lib/types";

const TABS: [ProjectStatus | "all", string][] = [
  ["all", "Todos"],
  ["progress", "Em andamento"],
  ["review", "Em revisão"],
  ["planned", "Planejados"],
  ["done", "Concluídos"],
];

export function ProjectsList({ projects }: { projects: ProjectListItem[] }) {
  const [filter, setFilter] = useState<ProjectStatus | "all">("all");
  const [q, setQ] = useState("");

  const list = projects.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (q && !`${p.name} ${p.client}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div className="row between" style={{ marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
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
