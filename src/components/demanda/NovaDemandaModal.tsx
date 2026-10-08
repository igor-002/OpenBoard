"use client";

// Formulário completo de nova demanda — o mesmo na lista, no quadro e no projeto.
// O essencial fica à vista; o resto abre em "Mais detalhes" pra não virar um
// formulário de 11 campos quando a pessoa só quer registrar e despachar.
import { useEffect, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { PickerCampo } from "@/components/ui/PickerCampo";
import { ClientePicker } from "@/components/atividades/ClientePicker";
import { emitToast } from "@/lib/toast";
import { ORIGEM_META, ORIGENS } from "@/lib/meta";
import { criarDemandaAction, regrasGlpiAction } from "@/app/(app)/demandas/actions";
import type { Priority, TaskOrigin } from "@/lib/types";

export function NovaDemandaModal({
  tipos,
  members,
  projects,
  projectIdInicial = "",
  onClose,
}: {
  tipos: { id: string; name: string }[];
  members: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  projectIdInicial?: string;
  onClose: (criada?: number) => void;
}) {
  const [projectId, setProjectId] = useState(projectIdInicial);
  const [mais, setMais] = useState(false);
  const [jaFeita, setJaFeita] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Regras de chamado GLPI (/settings/glpi). Sem regra, o campo não aparece.
  const [regras, setRegras] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let vivo = true;
    void regrasGlpiAction()
      .then((r) => vivo && setRegras(r))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => (f.get(k) as string | null)?.trim() || null;
    const glpi = s("glpi");
    setErro(null);
    start(async () => {
      const r = await criarDemandaAction({
        title: s("title") ?? "",
        description: s("description"),
        solicitante: s("solicitante"),
        origem: (s("origem") ?? "whatsapp") as TaskOrigin,
        priority: (s("priority") ?? "med") as Priority,
        assigneeId: s("assigneeId"),
        tipoId: s("tipoId"),
        projectId: projectId || null,
        ixcClienteId: s("ixcClienteId"),
        dueDate: s("dueDate"),
        estimatedMinutes: s("estimatedMinutes"),
        jaFeita: jaFeita ? { realMinutes: s("realMinutes") ?? "", solucao: s("solucao") ?? "" } : null,
        glpiRegraId: glpi === "nao" ? null : glpi === "auto" || !glpi ? undefined : glpi,
      });
      if (!r.ok) return setErro(r.error);
      emitToast({
        variant: "success",
        title: `Demanda #${r.numero} ${jaFeita ? "registrada como resolvida" : "aberta"}`,
        sub: r.chamado ? `Chamado #${r.chamado} aberto no GLPI` : undefined,
      });
      if (r.aviso) emitToast({ variant: "error", title: "Demanda aberta, mas sem chamado no GLPI", sub: r.aviso });
      onClose(r.numero);
    });
  }

  return (
    <Modal title="Nova demanda" onClose={() => onClose()} maxWidth={540}>
      <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label htmlFor="nd-title">O que precisa ser feito</label>
          <input className="input" id="nd-title" name="title" placeholder="Ex.: Cliente sem sinal na filial centro" required autoFocus maxLength={200} />
        </div>

        <div className="row gap12" style={{ alignItems: "flex-start" }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="nd-sol">Quem pediu</label>
            <input className="input" id="nd-sol" name="solicitante" placeholder="Nome de quem pediu" maxLength={120} />
          </div>
          <div className="field" style={{ width: 170 }}>
            <label htmlFor="nd-origem">Chegou por</label>
            <select className="input" id="nd-origem" name="origem" defaultValue="whatsapp">
              {ORIGENS.map((o) => (
                <option key={o} value={o}>
                  {ORIGEM_META[o].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row gap12" style={{ alignItems: "flex-start" }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="nd-assignee">Responsável</label>
            <select className="input" id="nd-assignee" name="assigneeId" defaultValue="">
              <option value="">Sem dono (decidir depois)</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ width: 170 }}>
            <label htmlFor="nd-priority">Prioridade</label>
            <select className="input" id="nd-priority" name="priority" defaultValue="med">
              <option value="high">Alta</option>
              <option value="med">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="nd-desc">Descrição</label>
          <textarea className="input" id="nd-desc" name="description" rows={3} placeholder="Contexto, o que foi combinado…" style={{ resize: "vertical" }} />
        </div>

        {regras.length > 0 && !jaFeita && (
          <div className="field">
            <label htmlFor="nd-glpi">Chamado no GLPI do Marketing</label>
            <select className="input" id="nd-glpi" name="glpi" defaultValue="auto">
              <option value="auto">Pelas regras (abre sozinho se o tipo ou o responsável pedir)</option>
              <option value="nao">Não abrir chamado</option>
              {regras.map((r) => (
                <option key={r.id} value={r.id}>
                  Abrir: {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="row gap8" style={{ fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>
          <input type="checkbox" checked={jaFeita} onChange={(e) => setJaFeita(e.target.checked)} />
          Já foi feito — só estou registrando
        </label>
        {jaFeita && (
          <div className="row gap12" style={{ alignItems: "flex-start" }}>
            <div className="field" style={{ width: 150 }}>
              <label htmlFor="nd-real">Tempo gasto (min)</label>
              <input className="input" id="nd-real" name="realMinutes" type="number" min={1} required placeholder="45" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="nd-solucao">O que foi feito</label>
              <input className="input" id="nd-solucao" name="solucao" required minLength={5} placeholder="Solução aplicada" />
            </div>
          </div>
        )}

        <button type="button" className="dm-link" style={{ alignSelf: "flex-start" }} aria-expanded={mais} onClick={() => setMais((v) => !v)}>
          {mais ? "Menos detalhes" : "Mais detalhes (tipo, prazo, cliente, projeto)"}
        </button>
        {/* Fica montado mesmo fechado: o que já foi preenchido não se perde ao recolher. */}
        <div style={{ display: mais ? "flex" : "none", flexDirection: "column", gap: 14 }}>
          <div className="row gap12" style={{ alignItems: "flex-start" }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="nd-tipo">Tipo</label>
              <select className="input" id="nd-tipo" name="tipoId" defaultValue="">
                <option value="">Sem tipo</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ width: 150 }}>
              <label htmlFor="nd-due">Prazo</label>
              <input className="input" id="nd-due" name="dueDate" type="date" />
            </div>
            {!jaFeita && (
              <div className="field" style={{ width: 130 }}>
                <label htmlFor="nd-est">Estimativa (min)</label>
                <input className="input" id="nd-est" name="estimatedMinutes" type="number" min={1} placeholder="60" />
              </div>
            )}
          </div>
          <ClientePicker />
          <PickerCampo
            className="field"
            label="Projeto"
            titulo="Escolher projeto"
            name="projectId"
            valor={projectId}
            opcoes={projects.map((p) => ({ id: p.id, nome: p.name }))}
            onChange={setProjectId}
            vazioLabel="Sem projeto"
            placeholderBusca="Buscar projeto…"
            vazioTexto="(nenhum projeto)"
          />
        </div>

        {erro && (
          <div className="form-error" role="alert">
            {erro}
          </div>
        )}

        <div className="row gap12" style={{ justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" className="btn" onClick={() => onClose()}>
            Fechar
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Salvando…" : jaFeita ? "Registrar como resolvida" : "Abrir demanda"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
