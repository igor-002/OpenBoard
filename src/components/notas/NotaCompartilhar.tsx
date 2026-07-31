"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { emitToast } from "@/lib/toast";
import {
  compartilharNota,
  removerCompartilhamento,
  usuariosParaCompartilhar,
} from "@/app/(app)/notas/actions";

export type ShareItem = { userId: string; nome: string; iniciais: string; cor: string; canEdit: boolean };
type Pessoa = { id: string; nome: string; iniciais: string; cor: string; cargo: string };

export function NotaCompartilhar({
  noteId,
  shares,
  onMudou,
  onClose,
}: {
  noteId: string;
  shares: ShareItem[];
  // A nota vive em useState no NotasView; router.refresh() sozinho não a
  // atualiza. Quem recarrega a nota é o pai, por aqui.
  onMudou: () => Promise<void>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [alvo, setAlvo] = useState("");
  const [permissao, setPermissao] = useState<"leitura" | "edicao">("leitura");
  const [busy, iniciar] = useTransition();

  useEffect(() => {
    void usuariosParaCompartilhar().then(setPessoas);
  }, []);

  const jaTem = new Set(shares.map((s) => s.userId));
  const disponiveis = pessoas.filter((p) => !jaTem.has(p.id));

  function adicionar() {
    if (!alvo) return;
    iniciar(async () => {
      const r = await compartilharNota(noteId, alvo, permissao === "edicao");
      if (r.error) return emitToast({ variant: "error", title: "Não deu pra compartilhar", sub: r.error });
      emitToast({ variant: "success", title: "Nota compartilhada" });
      setAlvo("");
      await onMudou();
      router.refresh();
    });
  }

  function mudar(userId: string, canEdit: boolean) {
    iniciar(async () => {
      const r = await compartilharNota(noteId, userId, canEdit);
      if (r.error) return emitToast({ variant: "error", title: "Não deu pra alterar", sub: r.error });
      await onMudou();
      router.refresh();
    });
  }

  function remover(userId: string) {
    iniciar(async () => {
      const r = await removerCompartilhamento(noteId, userId);
      if (r.error) return emitToast({ variant: "error", title: "Não deu pra remover", sub: r.error });
      await onMudou();
      router.refresh();
    });
  }

  return (
    <Modal title="Compartilhar nota" onClose={onClose} maxWidth={520}>
      <div className="row gap8" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Pessoa</label>
          <select className="input" value={alvo} onChange={(e) => setAlvo(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
            <option value="">Escolha…</option>
            {disponiveis.map((p) => (
              <option key={p.id} value={p.id}>{p.nome} — {p.cargo}</option>
            ))}
          </select>
        </div>
        <div style={{ width: 150 }}>
          <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Pode</label>
          <select className="input" value={permissao} onChange={(e) => setPermissao(e.target.value as "leitura" | "edicao")} style={{ width: "100%", marginTop: 6 }}>
            <option value="leitura">Ver</option>
            <option value="edicao">Editar</option>
          </select>
        </div>
        <button className="btn btn-primary" disabled={busy || !alvo} onClick={adicionar}>Adicionar</button>
      </div>

      <div style={{ marginTop: 18 }}>
        {shares.length === 0 ? (
          <p className="muted" style={{ fontSize: 12.5 }}>
            Ninguém além de você tem acesso a esta nota.
          </p>
        ) : (
          shares.map((s) => (
            <div key={s.userId} className="row between" style={{ alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)" }}>
              <span className="row gap8" style={{ alignItems: "center" }}>
                <Avatar user={{ name: s.nome, initials: s.iniciais, color: s.cor }} size={28} />
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.nome}</span>
              </span>
              <span className="row gap8" style={{ alignItems: "center" }}>
                <select
                  className="input"
                  value={s.canEdit ? "edicao" : "leitura"}
                  disabled={busy}
                  onChange={(e) => mudar(s.userId, e.target.value === "edicao")}
                  style={{ padding: "4px 8px", fontSize: 12.5 }}
                >
                  <option value="leitura">Ver</option>
                  <option value="edicao">Editar</option>
                </select>
                <button className="btn btn-ghost" disabled={busy} onClick={() => remover(s.userId)} style={{ padding: "4px 10px", fontSize: 12.5 }}>
                  Remover
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
