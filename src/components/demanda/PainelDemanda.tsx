"use client";

// Painel de detalhe da demanda — o único do sistema. Abre por cima de qualquer
// tela quando a URL tem `?d=<número>`, então toda demanda tem link próprio
// (notificação, busca, Hoje, lista e quadro apontam pro mesmo lugar).
import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useOverlayClose } from "@/components/ui/useOverlayClose";
import { ClientePicker } from "@/components/atividades/ClientePicker";
import { emitToast } from "@/lib/toast";
import { minLabel } from "@/lib/format";
import { ORIGEM_META, ORIGENS, PRIORITY_META, STATUS_DEMANDA, isAberta, isAtrasada } from "@/lib/meta";
import {
  carregarDemandaAction,
  atribuirDemandaAction,
  mudarStatusAction,
  editarDemandaAction,
  excluirDemandaAction,
  type EditaDemandaInput,
} from "@/app/(app)/demandas/actions";
import { addSubtask, toggleSubtask, deleteSubtask, addTaskComment, deleteTaskComment } from "@/app/(app)/kanban/actions";
import type { DemandaDetalhe } from "@/server/demandas";
import type { Priority, TaskColumn, TaskOrigin } from "@/lib/types";

// Abre o painel mantendo a tela e os filtros atuais. `acao` já deixa o painel na
// pergunta de Resolver/Aguardando (usado por quem arrasta ou clica em Resolver).
export function useAbrirDemanda() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return useCallback(
    (numero: number, acao?: "done" | "waiting") => {
      const params = new URLSearchParams(sp.toString());
      params.set("d", String(numero));
      if (acao) params.set("da", acao);
      else params.delete("da");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, sp],
  );
}

const fmtQuando = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const quando = (d: Date | string) => fmtQuando.format(new Date(d)).replace(".", "");

// Ações de status que fazem sentido a partir de cada estado.
type Pedido = { para: TaskColumn; rotulo: string; icone: "play" | "pause" | "check" | "arrowUp"; pede?: "solucao" | "motivo" };
const INICIAR: Pedido = { para: "doing", rotulo: "Iniciar", icone: "play" };
const AGUARDAR: Pedido = { para: "waiting", rotulo: "Aguardando", icone: "pause", pede: "motivo" };
const RESOLVER: Pedido = { para: "done", rotulo: "Resolver", icone: "check", pede: "solucao" };
const PROXIMOS: Record<TaskColumn, Pedido[]> = {
  todo: [INICIAR, AGUARDAR, RESOLVER],
  doing: [AGUARDAR, RESOLVER],
  waiting: [{ ...INICIAR, rotulo: "Retomar" }, RESOLVER],
  done: [{ para: "doing", rotulo: "Reabrir", icone: "arrowUp" }],
  canceled: [{ para: "todo", rotulo: "Reabrir", icone: "arrowUp" }],
};

export function PainelDemanda({ meId, isAdmin }: { meId: string; isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const numero = Number(sp.get("d")) || null;
  const acaoInicial = sp.get("da");

  const [d, setD] = useState<DemandaDetalhe | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "nao-achou">("carregando");
  const [pending, start] = useTransition();
  const [pedido, setPedido] = useState<Pedido | { para: "canceled"; rotulo: string; pede: "motivo" } | null>(null);
  const [texto, setTexto] = useState("");
  const [acomp, setAcomp] = useState("");
  const [item, setItem] = useState("");
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [trocandoCliente, setTrocandoCliente] = useState(false);

  const fechar = useCallback(() => {
    const params = new URLSearchParams(sp.toString());
    params.delete("d");
    params.delete("da");
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [router, pathname, sp]);

  const recarregar = useCallback(async (n: number) => {
    const r = await carregarDemandaAction(n);
    setD(r);
    setEstado(r ? "ok" : "nao-achou");
  }, []);

  useEffect(() => {
    if (!numero) return;
    let vivo = true;
    void carregarDemandaAction(numero).then((r) => {
      if (!vivo) return;
      setD(r);
      setEstado(r ? "ok" : "nao-achou");
      const pre = r && r.column !== acaoInicial ? (acaoInicial === "done" ? RESOLVER : acaoInicial === "waiting" ? AGUARDAR : null) : null;
      setPedido(pre);
      setTexto("");
      setConfirmaExcluir(false);
      setTrocandoCliente(false);
    });
    return () => {
      vivo = false;
    };
  }, [numero, acaoInicial]);

  const overlay = useOverlayClose(fechar);
  if (!numero) return null;

  // Roda uma ação, mostra o erro se houver e atualiza painel + tela de baixo.
  function roda(fn: () => Promise<{ ok?: boolean; error?: string }>, feito?: string, depois?: () => void) {
    start(async () => {
      const r = await fn();
      if (r.error) {
        emitToast({ variant: "error", title: r.error });
        return;
      }
      if (feito) emitToast({ variant: "success", title: feito });
      depois?.();
      if (numero) await recarregar(numero);
      router.refresh();
    });
  }
  const edita = (campos: EditaDemandaInput) => d && roda(() => editarDemandaAction(d.id, campos));

  function pedir(p: Pedido) {
    if (!d) return;
    if (!p.pede) return roda(() => mudarStatusAction(d.id, p.para), `Demanda #${d.numero}: ${STATUS_DEMANDA[p.para].label.toLowerCase()}`);
    setPedido(p);
    setTexto("");
  }
  function confirmarPedido() {
    if (!d || !pedido) return;
    const extra = pedido.pede === "solucao" ? { solucao: texto } : { motivo: texto };
    roda(
      () => mudarStatusAction(d.id, pedido.para, extra),
      `Demanda #${d.numero}: ${STATUS_DEMANDA[pedido.para].label.toLowerCase()}`,
      () => setPedido(null),
    );
  }

  const st = d ? STATUS_DEMANDA[d.column] : null;
  const atrasada = d ? isAtrasada(d.column, d.dueDate) : false;

  return (
    <div className="dm-fundo" {...overlay}>
      <aside className="dm-painel" role="dialog" aria-modal="true" aria-label={d ? `Demanda ${d.numero}` : "Demanda"}>
        <header className="dm-topo">
          <span className="dm-numero">#{numero}</span>
          {st && (
            <span className="hj-pilula" style={{ color: st.c, background: st.bg }}>
              <i />
              {st.label}
            </span>
          )}
          {d?.aguardandoVer && <span className="hj-chip cor-ambar">Ainda não viu</span>}
          {atrasada && <span className="hj-chip cor-vermelho">Atrasada</span>}
          <span style={{ flex: 1 }} />
          <button
            className="icon-btn"
            title="Copiar link"
            onClick={() => {
              void navigator.clipboard?.writeText(`${window.location.origin}/atividades?d=${numero}`);
              emitToast({ variant: "info", title: "Link copiado" });
            }}
          >
            <Icon name="link" size={17} />
          </button>
          <button className="icon-btn" onClick={fechar} aria-label="Fechar">
            <Icon name="plus" size={19} style={{ transform: "rotate(45deg)" }} />
          </button>
        </header>

        {estado === "carregando" && <div className="dm-aviso">Carregando…</div>}
        {estado === "nao-achou" && <div className="dm-aviso">Demanda #{numero} não existe ou foi excluída.</div>}

        {d && (
          <div className="dm-corpo">
            <input
              key={`t-${d.id}-${d.title}`}
              className="dm-titulo"
              defaultValue={d.title}
              aria-label="Título"
              onBlur={(e) => e.target.value.trim() !== d.title && edita({ title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />

            {/* ---- Andamento ---- */}
            <div className="dm-acoes">
              {PROXIMOS[d.column].map((p) => (
                <button
                  key={p.rotulo}
                  className={`btn ${p.para === "done" ? "btn-primary" : ""}`}
                  disabled={pending}
                  aria-pressed={pedido?.para === p.para}
                  onClick={() => pedir(p)}
                >
                  <Icon name={p.icone} size={15} />
                  {p.rotulo}
                </button>
              ))}
              {isAberta(d.column) && (
                <button
                  className="btn btn-ghost"
                  disabled={pending}
                  onClick={() => {
                    setPedido({ para: "canceled", rotulo: "Cancelar demanda", pede: "motivo" });
                    setTexto("");
                  }}
                >
                  Cancelar demanda
                </button>
              )}
            </div>

            {pedido?.pede && (
              <div className="dm-pedido">
                <label htmlFor="dm-pedido-txt">
                  {pedido.pede === "solucao"
                    ? "O que foi feito para resolver?"
                    : pedido.para === "waiting"
                      ? "Aguardando o quê? (cliente, fornecedor, peça…)"
                      : "Por que está sendo cancelada?"}
                </label>
                <textarea
                  id="dm-pedido-txt"
                  className="input"
                  rows={pedido.pede === "solucao" ? 3 : 2}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  autoFocus
                />
                <div className="row gap8" style={{ justifyContent: "flex-end" }}>
                  <button className="btn" onClick={() => setPedido(null)}>
                    Voltar
                  </button>
                  <button className="btn btn-primary" disabled={pending || texto.trim().length < 3} onClick={confirmarPedido}>
                    {pedido.para === "done" ? "Marcar como resolvida" : pedido.para === "waiting" ? "Marcar como aguardando" : "Cancelar demanda"}
                  </button>
                </div>
              </div>
            )}

            {d.column === "waiting" && d.waitingReason && (
              <div className="dm-nota cor-ambar">
                <b>Aguardando:</b> {d.waitingReason}
              </div>
            )}
            {d.column === "done" && d.solucao && (
              <div className="dm-nota cor-verde">
                <b>Solução:</b> {d.solucao}
              </div>
            )}

            {/* ---- Dados ---- */}
            <dl className="dm-dados">
              <Campo rotulo="Responsável">
                <select
                  className="dm-campo"
                  value={d.assigneeId ?? ""}
                  disabled={pending}
                  onChange={(e) => {
                    const novo = e.target.value || null;
                    const nome = d.opcoes.membros.find((m) => m.id === novo)?.name;
                    roda(() => atribuirDemandaAction(d.id, novo), nome ? `Passada para ${nome}` : "Ficou sem dono");
                  }}
                >
                  <option value="">Sem dono</option>
                  {d.opcoes.membros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Prioridade">
                <select className="dm-campo" value={d.priority} disabled={pending} onChange={(e) => edita({ priority: e.target.value as Priority })}>
                  {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Solicitante">
                <input
                  key={`s-${d.id}-${d.solicitante ?? ""}`}
                  className="dm-campo"
                  defaultValue={d.solicitante ?? ""}
                  placeholder="Quem pediu"
                  onBlur={(e) => e.target.value.trim() !== (d.solicitante ?? "") && edita({ solicitante: e.target.value })}
                />
              </Campo>
              <Campo rotulo="Chegou por">
                <select className="dm-campo" value={d.origem} disabled={pending} onChange={(e) => edita({ origem: e.target.value as TaskOrigin })}>
                  {ORIGENS.map((o) => (
                    <option key={o} value={o}>
                      {ORIGEM_META[o].label}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Tipo">
                <select className="dm-campo" value={d.tipoId ?? ""} disabled={pending} onChange={(e) => edita({ tipoId: e.target.value || null })}>
                  <option value="">Sem tipo</option>
                  {d.opcoes.tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Prazo">
                <input
                  className="dm-campo"
                  type="date"
                  value={d.dueIso ?? ""}
                  disabled={pending}
                  onChange={(e) => edita({ dueDate: e.target.value || null })}
                  style={atrasada ? { color: "var(--vermelho)", fontWeight: 600 } : undefined}
                />
              </Campo>
              <Campo rotulo="Projeto">
                <select className="dm-campo" value={d.projectId ?? ""} disabled={pending} onChange={(e) => edita({ projectId: e.target.value || null })}>
                  <option value="">Sem projeto</option>
                  {/* Projeto já encerrado não vem na lista de opções; mantém o atual visível. */}
                  {d.projectId && !d.opcoes.projetos.some((p) => p.id === d.projectId) && <option value={d.projectId}>{d.projectName}</option>}
                  {d.opcoes.projetos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Cliente">
                <span className="dm-campo dm-cliente">
                  <span className="dm-leitura">{d.cliente ? `${d.cliente.razao}${d.cliente.ixcId ? ` · IXC ${d.cliente.ixcId}` : ""}` : "Nenhum"}</span>
                  <button className="dm-link" aria-expanded={trocandoCliente} onClick={() => setTrocandoCliente((v) => !v)}>
                    {trocandoCliente ? "Fechar" : d.cliente ? "Trocar" : "Vincular"}
                  </button>
                </span>
              </Campo>
            </dl>

            {trocandoCliente && (
              <div className="dm-pedido">
                <ClientePicker onSelect={(c) => roda(() => editarDemandaAction(d.id, { ixcClienteId: c.id }), `Cliente: ${c.razao}`, () => setTrocandoCliente(false))} />
                {d.cliente && (
                  <button
                    className="dm-link"
                    style={{ alignSelf: "flex-start" }}
                    disabled={pending}
                    onClick={() => roda(() => editarDemandaAction(d.id, { ixcClienteId: null }), "Cliente removido", () => setTrocandoCliente(false))}
                  >
                    Remover cliente desta demanda
                  </button>
                )}
              </div>
            )}

            <div className="dm-tempos">
              <span>
                Aberta {quando(d.createdAt)}
                {d.criador ? ` por ${d.criador}` : ""}
              </span>
              {d.vistaEm && <span>Vista {quando(d.vistaEm)}</span>}
              {d.startedAt && <span>Iniciada {quando(d.startedAt)}</span>}
              {d.doneAt && <span>Resolvida {quando(d.doneAt)}</span>}
              {d.realMinutes != null && <span>Tempo gasto {minLabel(d.realMinutes)}</span>}
              {d.estimatedMinutes != null && <span>Estimativa {minLabel(d.estimatedMinutes)}</span>}
            </div>

            {/* ---- Pedido ---- */}
            <section>
              <h3 className="dm-secao">Descrição</h3>
              <textarea
                key={`d-${d.id}-${d.description ?? ""}`}
                className="input"
                rows={3}
                defaultValue={d.description ?? ""}
                placeholder="O que foi pedido, contexto, o que ficou combinado…"
                onBlur={(e) => e.target.value.trim() !== (d.description ?? "") && edita({ description: e.target.value })}
                style={{ resize: "vertical" }}
              />
            </section>

            {/* ---- Checklist ---- */}
            <section>
              <h3 className="dm-secao">
                Etapas
                {d.subtasks.length > 0 && (
                  <span className="hj-conta">
                    {d.subtasks.filter((s) => s.done).length}/{d.subtasks.length}
                  </span>
                )}
              </h3>
              {d.subtasks.map((s) => (
                <div key={s.id} className="dm-etapa">
                  <label>
                    <input type="checkbox" checked={s.done} disabled={pending} onChange={() => roda(() => toggleSubtask(s.id))} />
                    <span style={s.done ? { textDecoration: "line-through", color: "var(--muted)" } : undefined}>{s.title}</span>
                  </label>
                  <button className="icon-btn" title="Remover etapa" disabled={pending} onClick={() => roda(() => deleteSubtask(s.id))}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
              <form
                className="dm-linha-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (item.trim()) roda(() => addSubtask(d.id, item), undefined, () => setItem(""));
                }}
              >
                <input className="input" value={item} onChange={(e) => setItem(e.target.value)} placeholder="Adicionar etapa" aria-label="Nova etapa" />
              </form>
            </section>

            {/* ---- Histórico ---- */}
            <section>
              <h3 className="dm-secao">Histórico</h3>
              <form
                className="dm-linha-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (acomp.trim()) roda(() => addTaskComment(d.id, acomp), undefined, () => setAcomp(""));
                }}
              >
                <input
                  className="input"
                  value={acomp}
                  onChange={(e) => setAcomp(e.target.value)}
                  placeholder="Escrever acompanhamento"
                  aria-label="Novo acompanhamento"
                />
                <button className="btn" type="submit" disabled={pending || !acomp.trim()}>
                  Registrar
                </button>
              </form>
              <ol className="dm-historico">
                {[...d.linha].reverse().map((ev) =>
                  ev.tipo === "comentario" ? (
                    <li key={ev.id} className="dm-comentario">
                      {ev.autor && <Avatar user={ev.autor} size={26} ring={false} />}
                      <div>
                        <div className="dm-hist-topo">
                          <b>{ev.autor?.name ?? "—"}</b>
                          <span>{quando(ev.quando)}</span>
                          {(ev.autorId === meId || isAdmin) && (
                            <button className="dm-link" disabled={pending} onClick={() => roda(() => deleteTaskComment(ev.id))}>
                              apagar
                            </button>
                          )}
                        </div>
                        <p>{ev.texto}</p>
                      </div>
                    </li>
                  ) : (
                    <li key={ev.id} className="dm-evento">
                      <span>
                        <b>{ev.autor?.name ?? "Sistema"}</b> {ev.texto}
                        {ev.nota ? ` — ${ev.nota}` : ""}
                      </span>
                      <span>{quando(ev.quando)}</span>
                    </li>
                  ),
                )}
              </ol>
            </section>

            <div className="dm-rodape">
              {!confirmaExcluir ? (
                <button className="dm-link" onClick={() => setConfirmaExcluir(true)}>
                  Excluir demanda
                </button>
              ) : (
                <>
                  <span>Excluir apaga o histórico e tira a demanda dos relatórios. Para encerrar sem fazer, use Cancelar demanda.</span>
                  <button className="btn" onClick={() => setConfirmaExcluir(false)}>
                    Manter
                  </button>
                  <button
                    className="btn"
                    style={{ color: "var(--vermelho)" }}
                    disabled={pending}
                    onClick={() => {
                  start(async () => {
                    const r = await excluirDemandaAction(d.id);
                    if (!r.ok) return emitToast({ variant: "error", title: r.error });
                    emitToast({ variant: "success", title: `Demanda #${d.numero} excluída` });
                    fechar();
                    router.refresh();
                  });
                }}
              >
                    Excluir de vez
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}
