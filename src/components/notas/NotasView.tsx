"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { emitToast } from "@/lib/toast";
import type { NoteDetail, NoteListItem } from "@/server/notas";
import {
  alternarPin,
  carregarNota,
  criarNota,
  definirTags,
  excluirNota,
  salvarNotaAction,
  versaoDaNota,
  vincularNota,
} from "@/app/(app)/notas/actions";
import { NotaEditor } from "./NotaEditor";
import { NotaIA } from "./NotaIA";
import { NotaCompartilhar } from "./NotaCompartilhar";
import { NotaClientePicker } from "./NotaClientePicker";

type Opcoes = {
  projetos: { id: string; name: string }[];
  tarefas: { id: string; title: string }[];
};

type Props = {
  notas: NoteListItem[];
  notaInicial: NoteDetail | null;
  opcoes: Opcoes;
  tags: string[];
  ehAdmin: boolean;
  iaConfigurada: boolean;
  projetoPreSelecionado: string | null;
};

type Escopo = "todas" | "minhas" | "compartilhadas";
type Conflito = { title: string; body: string; version: number; editorNome: string; quando: string };

const DEBOUNCE = 1200;
const MAX_ESPERA = 10_000;

export function NotasView({
  notas,
  notaInicial,
  opcoes,
  tags,
  ehAdmin,
  iaConfigurada,
  projetoPreSelecionado,
}: Props) {
  const router = useRouter();

  const [nota, setNota] = useState<NoteDetail | null>(notaInicial);
  const [titulo, setTitulo] = useState(notaInicial?.title ?? "");
  const [corpo, setCorpo] = useState(notaInicial?.body ?? "");
  const [versao, setVersao] = useState(notaInicial?.version ?? 0);

  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const [conflito, setConflito] = useState<Conflito | null>(null);

  const [q, setQ] = useState("");
  const [escopo, setEscopo] = useState<Escopo>("todas");
  const [tagFiltro, setTagFiltro] = useState("");

  const [modalShare, setModalShare] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const [pendente, iniciar] = useTransition();

  const editavel = nota ? nota.access === "owner" || nota.access === "write" : false;
  const ehDono = nota?.access === "owner";

  // ── Autosave ─────────────────────────────────────────────────────────────
  // Refs porque o timer precisa ler o estado MAIS RECENTE sem se recriar a cada
  // tecla (o que zeraria o debounce e nunca salvaria).
  const ref = useRef({ titulo, corpo, versao, sujo, notaId: nota?.id ?? null, conflito: !!conflito });
  ref.current = { titulo, corpo, versao, sujo, notaId: nota?.id ?? null, conflito: !!conflito };

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primeiroToqueSujo = useRef<number>(0);

  const salvar = useCallback(async (): Promise<void> => {
    const s = ref.current;
    if (!s.notaId || !s.sujo || s.conflito) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setSalvando(true);
    const r = await salvarNotaAction({ id: s.notaId, title: s.titulo, body: s.corpo, version: s.versao });
    setSalvando(false);

    if (r.ok) {
      setVersao(r.version);
      setSujo(false);
      primeiroToqueSujo.current = 0;
      setSalvoEm(new Date(r.savedAt));
      return;
    }
    if ("conflito" in r) {
      setConflito(r.atual);
      return;
    }
    emitToast({ variant: "error", title: "Não deu pra salvar", sub: r.error });
  }, []);

  // Agenda o save: 1,2 s parado, ou 10 s desde a 1ª alteração (o que vier antes).
  const agendar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const agora = Date.now();
    if (!primeiroToqueSujo.current) primeiroToqueSujo.current = agora;
    const restanteMax = MAX_ESPERA - (agora - primeiroToqueSujo.current);
    timer.current = setTimeout(() => void salvar(), Math.max(0, Math.min(DEBOUNCE, restanteMax)));
  }, [salvar]);

  // StrictMode roda efeitos duas vezes em dev: sem este cleanup sairiam dois
  // saves, e o segundo colidiria com o primeiro gerando conflito falso.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const marcarSujo = useCallback(() => {
    setSujo(true);
    agendar();
  }, [agendar]);

  // Aba volta ao foco: se não há alteração local e o servidor avançou, recarrega
  // sozinho — mata a maior parte dos conflitos antes de acontecerem.
  useEffect(() => {
    function aoVoltar() {
      if (document.visibilityState !== "visible") return;
      const s = ref.current;
      if (!s.notaId || s.sujo || s.conflito) return;
      void versaoDaNota(s.notaId).then((v) => {
        if (v == null || v <= s.versao) return;
        void carregarNota(s.notaId!).then((n) => {
          if (!n) return;
          aplicar(n);
          emitToast({ variant: "info", title: "Nota atualizada", sub: "Alguém salvou uma versão mais nova." });
        });
      });
    }
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, []);

  // Fechar a aba com alteração pendente não pode passar em branco.
  useEffect(() => {
    function antesDeSair(e: BeforeUnloadEvent) {
      if (!ref.current.sujo) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", antesDeSair);
    return () => window.removeEventListener("beforeunload", antesDeSair);
  }, []);

  function aplicar(n: NoteDetail) {
    setNota(n);
    setTitulo(n.title);
    setCorpo(n.body);
    setVersao(n.version);
    setSujo(false);
    setConflito(null);
    primeiroToqueSujo.current = 0;
    setSalvoEm(null);
  }

  // ── Navegação entre notas (sem round-trip RSC) ───────────────────────────
  async function abrir(id: string) {
    if (id === nota?.id) return;
    await salvar();
    const n = await carregarNota(id);
    if (!n) return emitToast({ variant: "error", title: "Nota não encontrada" });
    aplicar(n);
    window.history.replaceState(null, "", `?n=${id}`);
  }

  function nova() {
    iniciar(async () => {
      await salvar();
      const r = await criarNota({ title: "", body: "", projectId: projetoPreSelecionado });
      if (!r.ok || !r.id) return emitToast({ variant: "error", title: "Não deu pra criar", sub: r.error });
      const n = await carregarNota(r.id);
      if (n) {
        aplicar(n);
        window.history.replaceState(null, "", `?n=${r.id}`);
      }
      router.refresh();
    });
  }

  // ── Lista filtrada (no client: instantâneo, a lista já veio inteira) ──────
  const lista = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return notas.filter((n) => {
      if (escopo === "minhas" && n.daOutraPessoa) return false;
      if (escopo === "compartilhadas" && !n.daOutraPessoa) return false;
      if (tagFiltro && !n.tags.includes(tagFiltro)) return false;
      if (!termo) return true;
      return n.title.toLowerCase().includes(termo) || n.resumo.toLowerCase().includes(termo);
    });
  }, [notas, q, escopo, tagFiltro]);

  const estado = conflito
    ? "Conflito de versão"
    : salvando
      ? "Salvando…"
      : sujo
        ? "Alterações não salvas"
        : salvoEm
          ? `Salvo às ${salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
          : editavel
            ? "Tudo salvo"
            : "Somente leitura";

  return (
    <div className="notas-grid">
      {/* ── Lista ─────────────────────────────────────────────────────── */}
      <aside className="notas-lista card">
        <div className="notas-lista-topo">
          <button className="btn btn-primary btn-block" onClick={nova} disabled={pendente}>
            <Icon name="plus" size={15} /> Nova nota
          </button>
          <input
            className="input"
            placeholder="Buscar nas notas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: "100%", marginTop: 10 }}
          />
          <div className="seg" style={{ marginTop: 10 }}>
            {(["todas", "minhas", "compartilhadas"] as Escopo[]).map((e) => (
              <button key={e} className={escopo === e ? "on" : ""} onClick={() => setEscopo(e)}>
                {e === "todas" ? "Todas" : e === "minhas" ? "Minhas" : "Comigo"}
              </button>
            ))}
          </div>
          {tags.length > 0 && (
            <div className="row gap8" style={{ flexWrap: "wrap", marginTop: 10 }}>
              {tags.map((t) => (
                <button
                  key={t}
                  className={`tag notas-tag${tagFiltro === t ? " on" : ""}`}
                  onClick={() => setTagFiltro((v) => (v === t ? "" : t))}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="notas-lista-itens">
          {lista.length === 0 && (
            <p className="muted" style={{ padding: "16px 14px", fontSize: 12.5, lineHeight: 1.6 }}>
              {notas.length === 0
                ? "Nenhuma nota ainda. Crie a primeira — ou use Ctrl+K de qualquer tela."
                : "Nada com esse filtro."}
            </p>
          )}
          {lista.map((n) => (
            <button
              key={n.id}
              className={`notas-item${n.id === nota?.id ? " on" : ""}`}
              onClick={() => void abrir(n.id)}
            >
              <span className="notas-item-topo">
                <span className="notas-item-titulo">{n.title || "Sem título"}</span>
                {n.pinned && <Icon name="pin" size={13} />}
              </span>
              {n.resumo && <span className="notas-item-resumo">{n.resumo}</span>}
              <span className="notas-item-rodape">
                <span>{n.updatedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                {n.vinculo && <span className="tag" style={{ fontSize: 10 }}>{n.vinculo.label}</span>}
                {n.daOutraPessoa && <span className="tag" style={{ fontSize: 10 }}>de {n.autorNome.split(" ")[0]}</span>}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Painel ────────────────────────────────────────────────────── */}
      <section className="notas-painel card">
        {!nota ? (
          <div className="notas-vazio">
            <Icon name="note" size={34} />
            <p>Escolha uma nota à esquerda ou crie uma nova.</p>
            <p className="muted" style={{ fontSize: 12.5 }}>
              Digite markdown normalmente (<code>## </code>, <code>- </code>, <code>[] </code>) ou use <code>/</code> para escolher o bloco.
            </p>
          </div>
        ) : (
          <>
            <div className="notas-cabecalho">
              <input
                className="notas-titulo"
                value={titulo}
                disabled={!editavel}
                placeholder="Título da nota"
                onChange={(e) => {
                  setTitulo(e.target.value);
                  marcarSujo();
                }}
                onBlur={() => void salvar()}
              />
              <div className="row gap8" style={{ alignItems: "center" }}>
                <span className={`notas-estado${sujo || conflito ? " alerta" : ""}`}>{estado}</span>
                {editavel && (
                  <button
                    className="icon-btn"
                    title={nota.pinned ? "Desafixar" : "Fixar no topo"}
                    onClick={() => iniciar(async () => { await alternarPin(nota.id); router.refresh(); })}
                  >
                    <Icon name="pin" size={16} />
                  </button>
                )}
                {ehDono && (
                  <button className="icon-btn" title="Compartilhar" onClick={() => setModalShare(true)}>
                    <Icon name="share" size={16} />
                  </button>
                )}
                {ehDono && (
                  <button className="icon-btn" title="Excluir" onClick={() => setConfirmarExcluir(true)}>
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="notas-meta">
              {!ehDono && (
                <span className="row gap8" style={{ alignItems: "center" }}>
                  <Avatar user={{ name: nota.autorNome, initials: nota.autorNome.slice(0, 2).toUpperCase(), color: "var(--muted)" }} size={22} />
                  <span className="muted" style={{ fontSize: 12 }}>
                    de {nota.autorNome} · {nota.access === "write" ? "você pode editar" : "somente leitura"}
                  </span>
                </span>
              )}
              {ehDono && (
                <>
                  <SelectVinculo
                    label="Projeto"
                    valor={nota.projectId ?? ""}
                    opcoes={opcoes.projetos.map((p) => ({ id: p.id, label: p.name }))}
                    onChange={(v) =>
                      iniciar(async () => {
                        await vincularNota({ id: nota.id, projectId: v || null, ixcClienteId: nota.ixcClienteId, taskId: nota.taskId });
                        const n = await carregarNota(nota.id);
                        if (n) setNota(n);
                        router.refresh();
                      })
                    }
                  />
                  <NotaClientePicker
                    clienteId={nota.ixcClienteId}
                    clienteNome={nota.clienteNome}
                    onChange={(v) =>
                      iniciar(async () => {
                        await vincularNota({ id: nota.id, projectId: nota.projectId, ixcClienteId: v, taskId: nota.taskId });
                        const n = await carregarNota(nota.id);
                        if (n) setNota(n);
                        router.refresh();
                      })
                    }
                  />
                  <SelectVinculo
                    label="Tarefa"
                    valor={nota.taskId ?? ""}
                    opcoes={opcoes.tarefas.map((t) => ({ id: t.id, label: t.title }))}
                    onChange={(v) =>
                      iniciar(async () => {
                        await vincularNota({ id: nota.id, projectId: nota.projectId, ixcClienteId: nota.ixcClienteId, taskId: v || null });
                        const n = await carregarNota(nota.id);
                        if (n) setNota(n);
                        router.refresh();
                      })
                    }
                  />
                  <TagsInput
                    tags={nota.tags}
                    onChange={(t) =>
                      iniciar(async () => {
                        await definirTags(nota.id, t);
                        const n = await carregarNota(nota.id);
                        if (n) setNota(n);
                        router.refresh();
                      })
                    }
                  />
                </>
              )}
            </div>

            {conflito && (
              <div className="notas-conflito">
                <strong>
                  {conflito.editorNome} salvou uma versão mais nova desta nota.
                </strong>
                <span>Você continua com a sua versão aqui. Escolha o que fazer:</span>
                <div className="row gap8" style={{ marginTop: 8 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setTitulo(conflito.title);
                      setCorpo(conflito.body);
                      setVersao(conflito.version);
                      setSujo(false);
                      setConflito(null);
                      if (nota) setNota({ ...nota, body: conflito.body, title: conflito.title, version: conflito.version });
                    }}
                  >
                    Usar a versão dele
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setVersao(conflito.version);
                      setConflito(null);
                      setSujo(true);
                      // Reenvia por cima, agora na versão que o servidor tem.
                      setTimeout(() => void salvar(), 0);
                    }}
                  >
                    Manter a minha e sobrescrever
                  </button>
                </div>
              </div>
            )}

            <NotaEditor
              noteId={nota.id}
              valorInicial={corpo}
              editavel={editavel && !conflito}
              onChange={(md) => {
                setCorpo(md);
                marcarSujo();
              }}
              onSalvarAgora={() => void salvar()}
            />

            <NotaIA
              key={nota.id}
              noteId={nota.id}
              iaConfigurada={iaConfigurada}
              ehAdmin={ehAdmin}
              resumoSalvo={nota.aiResumo}
              resumoDesatualizado={!!nota.aiAt && nota.aiAt < nota.updatedAt}
              onAntesDeRodar={salvar}
            />
          </>
        )}
      </section>

      {modalShare && nota && (
        <NotaCompartilhar
          noteId={nota.id}
          shares={nota.shares}
          onMudou={async () => {
            const n = await carregarNota(nota.id);
            if (n) setNota(n);
          }}
          onClose={() => setModalShare(false)}
        />
      )}

      {confirmarExcluir && nota && (
        <ConfirmModal
          title="Excluir nota"
          message={`“${nota.title || "Sem título"}” será apagada para você e para quem recebeu compartilhada. Não dá pra desfazer.`}
          confirmLabel="Excluir"
          danger
          onClose={() => setConfirmarExcluir(false)}
          onConfirm={() => {
            const id = nota.id;
            setConfirmarExcluir(false);
            iniciar(async () => {
              const r = await excluirNota(id);
              if (r.error) return emitToast({ variant: "error", title: "Não deu pra excluir", sub: r.error });
              setNota(null);
              setTitulo("");
              setCorpo("");
              setSujo(false);
              window.history.replaceState(null, "", "/notas");
              emitToast({ variant: "success", title: "Nota excluída" });
              router.refresh();
            });
          }}
        />
      )}

      {/* Sinal de que ainda tem escrita em voo — evita a pessoa achar que perdeu. */}
      {pendente && <span className="notas-pendente muted">…</span>}
    </div>
  );
}

function SelectVinculo({
  label,
  valor,
  opcoes,
  onChange,
}: {
  label: string;
  valor: string;
  opcoes: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="notas-vinculo">
      <span className="muted">{label}</span>
      <select className="input" value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function TagsInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const atual = tags.join(", ");
  const [texto, setTexto] = useState(atual);
  // Ajuste durante o render (padrão recomendado do React) em vez de efeito:
  // quando as tags mudam no servidor, o campo acompanha sem render em cascata.
  const [ultimo, setUltimo] = useState(atual);
  if (atual !== ultimo) {
    setUltimo(atual);
    setTexto(atual);
  }
  return (
    <label className="notas-vinculo">
      <span className="muted">Tags</span>
      <input
        className="input"
        value={texto}
        placeholder="separadas por vírgula"
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          const novas = texto.split(",").map((t) => t.trim()).filter(Boolean);
          if (novas.join("|") !== tags.join("|")) onChange(novas);
        }}
      />
    </label>
  );
}
