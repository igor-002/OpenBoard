"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { createDemandaAction } from "@/app/(marketing)/marketing/demandas/actions";
import type { GlpiUserOpt } from "@/server/glpi/users";

// Escala de prioridade do GLPI (1..5) — mesma nomenclatura de lá, pra o que se
// escolhe aqui bater com o que aparece no chamado.
const PRIORIDADES = [
  { v: 1, label: "Muito baixa" },
  { v: 2, label: "Baixa" },
  { v: 3, label: "Média" },
  { v: 4, label: "Alta" },
  { v: 5, label: "Muito alta" },
];

// Abre um chamado no GLPI (entidade Marketing) a partir do CRM.
export function NovaDemanda({
  trackedUsers,
  assignable,
  categorias = [],
  irParaDetalhe = true,
}: {
  trackedUsers: GlpiUserOpt[];
  assignable: GlpiUserOpt[];
  categorias?: { id: number; nome: string }[];
  // No quadro, criar e ser jogado pro detalhe tira o usuário do lugar: lá o chamado
  // novo já aparece sozinho na coluna "Novos", então só recarrega.
  irParaDetalhe?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [requesterId, setRequesterId] = useState(trackedUsers[0] ? String(trackedUsers[0].id) : "");
  const [assigneeId, setAssigneeId] = useState("");
  const [type, setType] = useState("2");
  const [categoryId, setCategoryId] = useState("");
  const [urgency, setUrgency] = useState("3");
  const [dueAt, setDueAt] = useState("");

  function submit() {
    setErr(null);
    start(async () => {
      const r = await createDemandaAction({
        name,
        content,
        requesterId: Number(requesterId),
        assigneeId: assigneeId ? Number(assigneeId) : undefined,
        type: Number(type),
        categoryId: categoryId ? Number(categoryId) : null,
        urgency: Number(urgency),
        dueAt: dueAt || null,
      });
      if (r.ok) {
        setOpen(false);
        setName("");
        setContent("");
        setAssigneeId("");
        setCategoryId("");
        setDueAt("");
        if (r.id && irParaDetalhe) router.push(`/marketing/demandas/${r.id}`);
        else router.refresh();
      } else {
        setErr(r.error || "Falha ao criar o chamado.");
      }
    });
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <Icon name="plus" size={15} /> Nova demanda
      </button>
      {open && (
        <Modal title="Nova demanda no GLPI" onClose={() => setOpen(false)} maxWidth={520}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Título</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Arte para campanha de junho" style={{ width: "100%", marginTop: 6 }} />
            </div>
            <div>
              <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Descrição</label>
              <textarea className="input" value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Detalhe a demanda…" style={{ width: "100%", marginTop: 6, resize: "vertical" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Solicitante</label>
                <select className="input" value={requesterId} onChange={(e) => setRequesterId(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
                  {trackedUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Atribuir a</label>
                <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
                  <option value="">Ninguém por enquanto</option>
                  {assignable.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            {categorias.length > 0 && (
              <div>
                <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Categoria de serviço</label>
                <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
                  <option value="">Sem categoria</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Tipo</label>
                <select className="input" value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
                  <option value="2">Requisição</option>
                  <option value="1">Incidente</option>
                </select>
              </div>
              <div>
                <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Prioridade</label>
                <select className="input" value={urgency} onChange={(e) => setUrgency(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
                  {PRIORIDADES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Concluir até</label>
                <input type="date" className="input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={{ width: "100%", marginTop: 6 }} />
              </div>
            </div>
            <span className="muted" style={{ fontSize: 11.5, marginTop: -4 }}>
              O prazo é controlado pelo OpenBoard (o GLPI não tem esse campo) e vira um acompanhamento no chamado.
            </span>
            {err && <div style={{ color: "var(--st-risk)", fontSize: 12.5, fontWeight: 600 }}>{err}</div>}
            <div className="row gap8" style={{ justifyContent: "flex-end", marginTop: 4 }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={pending}>Cancelar</button>
              <button className="btn btn-primary" onClick={submit} disabled={pending || !name.trim() || !requesterId}>
                {pending ? "Criando…" : "Criar chamado"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
