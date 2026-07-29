"use client";

// Paleta de comandos global (Ctrl+K). Captura rápida de tarefa/atividade e
// "ir para" de qualquer lugar do app.
//
// Atalho: Ctrl+K (padrão de mercado) e Ctrl+J como reserva. Alt+Espaço NÃO dá:
// o Windows intercepta pro menu da janela e o navegador nunca recebe a tecla.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { emitToast } from "@/lib/toast";
import {
  paletteSearchAction,
  paletteOpcoesAction,
  paletteCriarTarefaAction,
  paletteCriarAtividadeAction,
  type PaletteOpcoes,
} from "@/app/(app)/palette-actions";
import type { PaletteHit, PaletteKind } from "@/server/palette";

type Modo = "busca" | "tarefa" | "atividade";

const ICONE: Record<PaletteKind, IconName> = {
  projeto: "folder",
  tarefa: "check",
  cliente: "users",
  chamado: "inbox",
};
const ROTULO: Record<PaletteKind, string> = {
  projeto: "Projeto",
  tarefa: "Tarefa",
  cliente: "Cliente",
  chamado: "Chamado",
};

export function CommandPalette() {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [modo, setModo] = useState<Modo>("busca");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PaletteHit[]>([]);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [opcoes, setOpcoes] = useState<PaletteOpcoes>({ projetos: [], tipos: [] });

  // Campos dos formulários rápidos.
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tipoId, setTipoId] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const fechar = useCallback(() => {
    setAberta(false);
    setModo("busca");
    setQ("");
    setHits([]);
    setSel(0);
    setProjectId("");
    setDueDate("");
  }, []);

  // Atalho global de abertura.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K" || e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setAberta((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Carrega projetos/tipos na 1ª abertura (não no boot da página).
  useEffect(() => {
    if (!aberta || opcoes.tipos.length || opcoes.projetos.length) return;
    void paletteOpcoesAction().then((o) => {
      setOpcoes(o);
      setTipoId((t) => t || o.tipos[0]?.id || "");
    });
  }, [aberta, opcoes.tipos.length, opcoes.projetos.length]);

  useEffect(() => {
    if (aberta) inputRef.current?.focus();
  }, [aberta, modo]);

  // Busca com debounce — a paleta consulta a cada tecla.
  useEffect(() => {
    const termo = q.trim();
    if (!aberta || modo !== "busca" || termo.length < 2) return;
    const t = setTimeout(() => {
      void paletteSearchAction(termo).then((r) => {
        setHits(r);
        setSel(0);
      });
    }, 180);
    return () => clearTimeout(t);
  }, [q, aberta, modo]);

  if (!aberta) return null;

  const termo = q.trim();
  const temTexto = termo.length > 0;
  // Deriva em vez de limpar por efeito: enquanto o termo é curto (ou o resultado
  // ainda é da busca anterior), não mostra nada.
  const hitsVisiveis = termo.length < 2 ? [] : hits;
  // Ações de criação aparecem no topo assim que há texto: capturar é o caso de uso
  // principal, buscar é o secundário.
  const acoes = temTexto
    ? [
        { id: "nova-tarefa", label: `Criar tarefa “${q.trim()}”`, icon: "plus" as IconName },
        { id: "nova-atividade", label: `Criar atividade “${q.trim()}”`, icon: "zap" as IconName },
      ]
    : [];
  const total = acoes.length + hitsVisiveis.length;

  function executar(indice: number) {
    if (indice < acoes.length) {
      setModo(acoes[indice].id === "nova-tarefa" ? "tarefa" : "atividade");
      return;
    }
    const hit = hitsVisiveis[indice - acoes.length];
    if (!hit) return;
    fechar();
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      // Esc no formulário volta pra busca; na busca, fecha.
      if (modo === "busca") fechar();
      else setModo("busca");
      return;
    }
    if (modo !== "busca") return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => (total ? (s + 1) % total : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => (total ? (s - 1 + total) % total : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executar(sel);
    }
  }

  function criarTarefa() {
    setBusy(true);
    void paletteCriarTarefaAction({ title: q, projectId: projectId || null, dueDate: dueDate || null }).then((r) => {
      setBusy(false);
      if (!r.ok) return emitToast({ variant: "error", title: "Não deu pra criar", sub: r.error });
      emitToast({ variant: "success", title: "Tarefa criada", sub: q.trim() });
      const href = r.href;
      fechar();
      if (href) router.push(href);
      else router.refresh();
    });
  }

  function criarAtividade() {
    setBusy(true);
    void paletteCriarAtividadeAction({ title: q, tipoId }).then((r) => {
      setBusy(false);
      if (!r.ok) return emitToast({ variant: "error", title: "Não deu pra criar", sub: r.error });
      emitToast({ variant: "success", title: "Atividade criada", sub: q.trim() });
      const href = r.href;
      fechar();
      if (href) router.push(href);
      else router.refresh();
    });
  }

  return (
    <div
      onClick={fechar}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        backdropFilter: "blur(2px)",
        zIndex: 400,
        display: "grid",
        placeItems: "start center",
        padding: "12vh 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="card"
        style={{ width: "100%", maxWidth: 560, padding: 0, overflow: "hidden" }}
      >
        {/* Campo de texto */}
        <div className="row gap8" style={{ alignItems: "center", padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
          <span className="muted"><Icon name={modo === "busca" ? "search" : "plus"} size={16} /></span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={modo === "busca" ? "Buscar ou criar…" : "Título"}
            style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 15, color: "var(--ink)" }}
          />
          <kbd className="muted" style={{ fontSize: 10.5, border: "1px solid var(--line)", borderRadius: 5, padding: "2px 6px" }}>
            esc
          </kbd>
        </div>

        {modo === "busca" && (
          <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
            {!temTexto && (
              <div className="muted" style={{ padding: "18px 16px", fontSize: 12.5, lineHeight: 1.7 }}>
                Digite para buscar projetos, tarefas, clientes e chamados.
                <br />
                Ou escreva um título e crie uma tarefa na hora.
              </div>
            )}

            {acoes.map((a, i) => (
              <Linha key={a.id} ativo={sel === i} onClick={() => executar(i)} onHover={() => setSel(i)}>
                <span style={{ color: "var(--primary)" }}><Icon name={a.icon} size={15} /></span>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.label}</span>
              </Linha>
            ))}

            {hitsVisiveis.map((h, i) => {
              const idx = acoes.length + i;
              return (
                <Linha key={`${h.kind}-${h.id}`} ativo={sel === idx} onClick={() => executar(idx)} onHover={() => setSel(idx)}>
                  <span className="muted"><Icon name={ICONE[h.kind]} size={15} /></span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {h.titulo}
                    </span>
                    {h.sub && <span className="muted" style={{ fontSize: 11.5 }}>{h.sub}</span>}
                  </span>
                  <span className="tag" style={{ fontSize: 10.5 }}>{ROTULO[h.kind]}</span>
                </Linha>
              );
            })}

            {temTexto && hitsVisiveis.length === 0 && termo.length >= 2 && (
              <div className="muted" style={{ padding: "10px 16px 16px", fontSize: 12 }}>Nada encontrado na busca.</div>
            )}
          </div>
        )}

        {modo === "tarefa" && (
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 12 }}>
              <div>
                <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Projeto</label>
                <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
                  <option value="">Sem projeto (atividade avulsa)</option>
                  {opcoes.projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Prazo</label>
                <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: "100%", marginTop: 6 }} />
              </div>
            </div>
            <Rodape onVoltar={() => setModo("busca")} onConfirmar={criarTarefa} busy={busy} podeConfirmar={!!q.trim()} rotulo="Criar tarefa" />
          </div>
        )}

        {modo === "atividade" && (
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Tipo</label>
              <select className="input" value={tipoId} onChange={(e) => setTipoId(e.target.value)} style={{ width: "100%", marginTop: 6 }}>
                {opcoes.tipos.length === 0 && <option value="">(nenhum tipo cadastrado)</option>}
                {opcoes.tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <span className="muted" style={{ fontSize: 11.5 }}>O tipo é o que os relatórios agrupam.</span>
            </div>
            <Rodape onVoltar={() => setModo("busca")} onConfirmar={criarAtividade} busy={busy} podeConfirmar={!!q.trim() && !!tipoId} rotulo="Criar atividade" />
          </div>
        )}
      </div>
    </div>
  );
}

function Linha({
  ativo,
  onClick,
  onHover,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  onHover: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      className="row gap8"
      style={{
        alignItems: "center",
        padding: "9px 14px",
        cursor: "pointer",
        background: ativo ? "var(--surface-2)" : "transparent",
        borderLeft: `2px solid ${ativo ? "var(--primary)" : "transparent"}`,
      }}
    >
      {children}
    </div>
  );
}

function Rodape({
  onVoltar,
  onConfirmar,
  busy,
  podeConfirmar,
  rotulo,
}: {
  onVoltar: () => void;
  onConfirmar: () => void;
  busy: boolean;
  podeConfirmar: boolean;
  rotulo: string;
}) {
  return (
    <div className="row gap8" style={{ justifyContent: "flex-end" }}>
      <button className="btn btn-ghost" onClick={onVoltar} disabled={busy}>Voltar</button>
      <button className="btn btn-primary" onClick={onConfirmar} disabled={busy || !podeConfirmar}>
        {busy ? "Criando…" : rotulo}
      </button>
    </div>
  );
}
