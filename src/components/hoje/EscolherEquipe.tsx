"use client";

// Marca quem faz parte da equipe de demandas. Fica na tela Hoje porque é onde a
// diferença aparece: usuário de outra área tem login no sistema, mas não é da equipe.
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { emitToast } from "@/lib/toast";
import { definirEquipeAction } from "@/app/(app)/demandas/actions";

type Usuario = { id: string; name: string; jobTitle: string; equipe: boolean };

export function EscolherEquipe({ usuarios, definida }: { usuarios: Usuario[]; definida: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button className="dm-link" onClick={() => setAberto(true)}>
        {definida ? "Editar equipe" : "Escolher equipe"}
      </button>
      {/* Montado só quando abre: a seleção sempre parte do que está salvo. */}
      {aberto && <Seletor usuarios={usuarios} onClose={() => setAberto(false)} />}
    </>
  );
}

function Seletor({ usuarios, onClose }: { usuarios: Usuario[]; onClose: () => void }) {
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(usuarios.filter((u) => u.equipe).map((u) => u.id)));
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function alterna(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function salvar() {
    setErro(null);
    start(async () => {
      const r = await definirEquipeAction([...marcados]);
      if (!r.ok) return setErro(r.error);
      emitToast({
        variant: "success",
        title: marcados.size ? `Equipe com ${marcados.size} ${marcados.size === 1 ? "pessoa" : "pessoas"}` : "Equipe desmarcada: mostrando todos",
      });
      onClose();
    });
  }

  return (
    <Modal title="Quem é da sua equipe" onClose={onClose} maxWidth={460}>
      <p className="muted" style={{ fontSize: 13.5, margin: "0 0 12px" }}>
        Só quem estiver marcado aparece em Hoje e como opção de responsável. Isso não muda o acesso de ninguém ao sistema.
      </p>
      <div className="eq-lista">
        {usuarios.map((u) => (
          <label key={u.id}>
            <input type="checkbox" checked={marcados.has(u.id)} onChange={() => alterna(u.id)} />
            <span>
              <span className="eq-nome">{u.name}</span>
              <span className="eq-cargo"> · {u.jobTitle}</span>
            </span>
          </label>
        ))}
      </div>
      {erro && (
        <div className="form-error" role="alert" style={{ marginTop: 12 }}>
          {erro}
        </div>
      )}
      <div className="row gap12" style={{ justifyContent: "flex-end", marginTop: 16 }}>
        <button className="btn" onClick={onClose}>
          Fechar
        </button>
        <button className="btn btn-primary" disabled={pending} onClick={salvar}>
          {pending ? "Salvando…" : "Salvar equipe"}
        </button>
      </div>
    </Modal>
  );
}
