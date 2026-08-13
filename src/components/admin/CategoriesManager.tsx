"use client";

import { useEffect, useState, useTransition, useActionState } from "react";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { createProjectCategory, setProjectCategoryActive, renameProjectCategory } from "@/app/(app)/settings/categorias/actions";
import type { ProjectCategoryRow } from "@/server/project-categories";

export function CategoriesManager({ categorias }: { categorias: ProjectCategoryRow[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [state, formAction, creating] = useActionState(createProjectCategory, {});

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const ativas = categorias.filter((c) => c.active).length;

  function toggle(id: string, active: boolean) {
    setErr(null);
    start(async () => {
      const r = await setProjectCategoryActive(id, active);
      if (r.error) setErr(r.error);
      router.refresh();
    });
  }

  function rename(id: string, name: string) {
    setErr(null);
    start(async () => {
      const r = await renameProjectCategory(id, name);
      if (r.error) setErr(r.error);
      router.refresh();
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Categorias de projeto</h1>
          <p className="page-sub">
            {ativas} {ativas === 1 ? "categoria ativa" : "categorias ativas"} · usadas no cadastro de projeto e na integração do Ploomes
          </p>
        </div>
      </div>

      <Card>
        <form action={formAction} className="row gap12" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 240, marginBottom: 0 }}>
            <label htmlFor="name">Nova categoria</label>
            <input className="input" id="name" name="name" placeholder="Implantação, Suporte, Hotspot…" required minLength={2} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            <Icon name="plus" size={16} />
            {creating ? "Criando…" : "Adicionar"}
          </button>
        </form>
        {state.error && <div className="form-error" style={{ marginTop: 12 }}>{state.error}</div>}
      </Card>

      {err && <div className="form-error" style={{ margin: "16px 0" }}>{err}</div>}

      <Card pad={false} style={{ marginTop: "var(--gap)" }}>
        <table className="tbl" style={{ marginTop: 6 }}>
          <thead>
            <tr><th>Categoria</th><th>Projetos</th><th>Situação</th><th></th></tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id} style={c.active ? undefined : { opacity: 0.55 }}>
                <td><CategoryName initial={c.name} onSave={(name) => rename(c.id, name)} /></td>
                <td>{c.projectCount}</td>
                <td className="muted" style={{ fontSize: 12 }}>{c.active ? "Ativa" : "Desativada"}</td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn"
                    style={{ padding: "5px 12px", fontSize: 12, color: c.active ? "var(--st-risk)" : "var(--st-done)" }}
                    disabled={pending}
                    title={c.active ? "Some do cadastro e da API; os projetos atuais continuam nela" : "Volta a aparecer no cadastro e na API"}
                    onClick={() => toggle(c.id, !c.active)}
                  >
                    {c.active ? "Desativar" : "Reativar"}
                  </button>
                </td>
              </tr>
            ))}
            {categorias.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ padding: 20 }}>
                  Nenhuma categoria ainda. Crie a primeira acima — ou cadastre um projeto, que a categoria digitada entra sozinha.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// Nome editável no lugar: salva no blur, e só quando mudou de verdade.
// Campo não-controlado com `key={initial}`: quando o servidor devolve outro
// nome, o input remonta com o valor novo — sem sincronizar estado num efeito.
function CategoryName({ initial, onSave }: { initial: string; onSave: (name: string) => void }) {
  return (
    <input
      key={initial}
      className="input"
      style={{ width: 240, padding: "7px 10px" }}
      defaultValue={initial}
      onBlur={(e) => {
        const name = e.target.value.trim();
        if (!name || name === initial) { e.target.value = initial; return; }
        onSave(name);
      }}
    />
  );
}
