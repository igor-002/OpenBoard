"use client";

// Categoria (ITILCategory) do chamado, editável no lugar onde ela já era exibida:
// na linha "Categoria" do card Detalhes (/marketing/demandas/[id]) e na etiqueta do
// bloco do chamado dentro do modal do quadro. Antes só dava pra escolher categoria
// na CRIAÇÃO — reclassificar exigia abrir o GLPI.
//
// A gravação vai pela API v1 (ver `updateCategory` em server/glpi/write.ts).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { emitToast } from "@/lib/toast";
import { atualizarCategoriaAction } from "@/app/(marketing)/marketing/demandas/actions";

export interface CategoriaOpt {
  id: number;
  nome: string;
}

export function CategoriaPicker({
  glpiId,
  categoriaId,
  categoriaNome,
  categorias,
  variant = "row",
  onSaved,
}: {
  glpiId: number;
  categoriaId: number | null;
  categoriaNome: string | null;
  categorias: CategoriaOpt[];
  variant?: "row" | "tag";
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(categoriaId ? String(categoriaId) : "");
  const [salvando, start] = useTransition();

  const atual = categoriaId ? String(categoriaId) : "";
  const rotulo = categoriaNome || "Sem categoria";

  function salvar() {
    const escolhido = valor ? Number(valor) : null;
    start(async () => {
      const r = await atualizarCategoriaAction(glpiId, escolhido);
      if (!r.ok) {
        emitToast({ variant: "error", title: "Falha ao mudar a categoria", sub: r.error });
        return;
      }
      setEditando(false);
      emitToast({
        variant: "success",
        title: escolhido ? "Categoria atualizada" : "Categoria removida",
        sub: `Chamado #${glpiId}`,
      });
      onSaved?.();
      router.refresh();
    });
  }

  function cancelar() {
    setValor(atual);
    setEditando(false);
  }

  // Sem lista (v1 fora do ar ou entidade sem categorias) não dá pra escolher nada:
  // mostra só o valor atual, sem prometer uma edição que não funcionaria.
  if (!editando || categorias.length === 0) {
    const podeEditar = categorias.length > 0;
    if (variant === "tag") {
      return (
        <button
          type="button"
          className="tag"
          disabled={!podeEditar}
          onClick={() => setEditando(true)}
          title={podeEditar ? "Mudar a categoria no GLPI" : undefined}
          style={{
            fontSize: 10.5,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            cursor: podeEditar ? "pointer" : "default",
            border: "1px dashed transparent",
          }}
        >
          {rotulo}
          {podeEditar && <Icon name="edit" size={10} />}
        </button>
      );
    }
    return (
      <span className="row gap8" style={{ alignItems: "center", justifyContent: "flex-end" }}>
        <span style={{ color: categoriaNome ? "inherit" : "var(--muted)" }}>{rotulo}</span>
        {podeEditar && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setEditando(true)}
            title="Mudar a categoria no GLPI"
            style={{ padding: "1px 6px" }}
          >
            <Icon name="edit" size={12} />
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="row gap8" style={{ alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
      <select
        className="input"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        disabled={salvando}
        style={{ fontSize: 12.5, padding: "3px 6px", maxWidth: 200 }}
      >
        <option value="">Sem categoria</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-primary"
        disabled={salvando || valor === atual}
        onClick={salvar}
        style={{ padding: "2px 8px", fontSize: 11.5 }}
      >
        <Icon name="check" size={12} /> {salvando ? "Salvando…" : "Salvar"}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={salvando}
        onClick={cancelar}
        style={{ padding: "2px 8px", fontSize: 11.5 }}
      >
        Cancelar
      </button>
    </span>
  );
}
