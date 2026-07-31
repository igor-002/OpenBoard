"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { emitToast } from "@/lib/toast";
import {
  criarTarefasDaNotaAction,
  extrairTarefasAction,
  perguntarNotaAction,
  resumirNotaAction,
} from "@/app/(app)/notas/actions";
import type { TarefaSugerida } from "@/server/notas-ai";

type Props = {
  noteId: string;
  iaConfigurada: boolean;
  ehAdmin: boolean;
  resumoSalvo: string | null;
  resumoDesatualizado: boolean;
  // Salva o que estiver pendente antes de a IA ler a nota no banco.
  onAntesDeRodar: () => Promise<void>;
};

type Aba = null | "resumo" | "pergunta" | "tarefas";

export function NotaIA({ noteId, iaConfigurada, ehAdmin, resumoSalvo, resumoDesatualizado, onAntesDeRodar }: Props) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>(null);
  const [rodando, setRodando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const [resumo, setResumo] = useState<string | null>(resumoSalvo);
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);
  const [tarefas, setTarefas] = useState<TarefaSugerida[] | null>(null);
  const [escolhidas, setEscolhidas] = useState<Set<number>>(new Set());
  const [criando, iniciarCriacao] = useTransition();

  // O painel é remontado a cada nota (key={nota.id} no pai), então não existe
  // efeito de "limpar ao trocar" — o estado nasce zerado sozinho.

  // Cronômetro no lugar de streaming — mesmo padrão da análise de leads.
  const inicio = useRef(0);
  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setSegundos((Date.now() - inicio.current) / 1000), 100);
    return () => clearInterval(t);
  }, [rodando]);

  async function rodar<T>(fn: () => Promise<T>): Promise<T> {
    setErro(null);
    inicio.current = Date.now();
    setSegundos(0);
    setRodando(true);
    await onAntesDeRodar();
    try {
      return await fn();
    } finally {
      setRodando(false);
    }
  }

  async function gerarResumo() {
    setAba("resumo");
    const r = await rodar(() => resumirNotaAction(noteId));
    if (!r.ok) return setErro(r.error);
    setResumo(r.resumo);
    router.refresh();
  }

  async function perguntar() {
    if (!pergunta.trim()) return;
    setAba("pergunta");
    const r = await rodar(() => perguntarNotaAction(noteId, pergunta));
    if (!r.ok) return setErro(r.error);
    setResposta(r.resposta);
  }

  async function extrair() {
    setAba("tarefas");
    const r = await rodar(() => extrairTarefasAction(noteId));
    if (!r.ok) return setErro(r.error);
    setTarefas(r.tarefas);
    setEscolhidas(new Set(r.tarefas.map((_, i) => i)));
  }

  function criarTarefas() {
    if (!tarefas) return;
    const sel = tarefas.filter((_, i) => escolhidas.has(i));
    iniciarCriacao(async () => {
      const r = await criarTarefasDaNotaAction(noteId, sel);
      if (r.error) return emitToast({ variant: "error", title: "Não deu pra criar", sub: r.error });
      emitToast({ variant: "success", title: `${r.criadas} tarefa(s) criada(s)`, sub: "Estão no topo do “A fazer”." });
      setTarefas(null);
      setAba(null);
      router.refresh();
    });
  }

  return (
    <div className="nota-ia">
      <div className="row gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <span className="nota-ia-titulo">
          <Icon name="sparkles" size={15} /> IA
        </span>
        <button className="btn btn-ghost nota-ia-btn" disabled={!iaConfigurada || rodando} onClick={gerarResumo}>
          {resumo ? "Refazer resumo" : "Resumir"}
        </button>
        <button className="btn btn-ghost nota-ia-btn" disabled={!iaConfigurada || rodando} onClick={extrair}>
          Extrair tarefas
        </button>
        <button
          className="btn btn-ghost nota-ia-btn"
          disabled={!iaConfigurada || rodando}
          onClick={() => setAba((a) => (a === "pergunta" ? null : "pergunta"))}
        >
          Perguntar
        </button>
        {rodando && <span className="muted" style={{ fontSize: 12 }}>Pensando… {segundos.toFixed(1)}s</span>}
      </div>

      {!iaConfigurada && (
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          IA não configurada.{" "}
          {ehAdmin ? (
            <a href="/comercial/config" style={{ color: "var(--primary)", fontWeight: 600 }}>
              Informe a chave da OpenAI em Config IA
            </a>
          ) : (
            "Peça a um admin para informar a chave da OpenAI em Comercial → Config IA."
          )}
        </p>
      )}

      {erro && <p className="form-error" style={{ marginTop: 8 }}>{erro}</p>}

      {aba === "pergunta" && (
        <div style={{ marginTop: 10 }}>
          <div className="row gap8">
            <input
              className="input"
              style={{ flex: 1 }}
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void perguntar();
                }
              }}
              placeholder="O que você quer saber sobre esta nota?"
            />
            <button className="btn btn-primary" disabled={rodando || !pergunta.trim()} onClick={perguntar}>
              Perguntar
            </button>
          </div>
          {resposta && <div className="nota-ia-saida">{resposta}</div>}
        </div>
      )}

      {aba === "resumo" && resumo && (
        <div className="nota-ia-saida">
          {resumoDesatualizado && (
            <p className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>
              A nota mudou depois deste resumo.
            </p>
          )}
          {resumo}
        </div>
      )}

      {aba === "tarefas" && tarefas && (
        <div style={{ marginTop: 10 }}>
          {tarefas.length === 0 ? (
            <p className="muted" style={{ fontSize: 12.5 }}>A IA não achou nenhuma ação pendente nesta nota.</p>
          ) : (
            <>
              {tarefas.map((t, i) => (
                <label key={i} className="row gap8 nota-ia-tarefa">
                  <input
                    type="checkbox"
                    checked={escolhidas.has(i)}
                    onChange={(e) => {
                      const s = new Set(escolhidas);
                      if (e.target.checked) s.add(i);
                      else s.delete(i);
                      setEscolhidas(s);
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 13 }}>{t.titulo}</span>
                  {t.prazo && <span className="tag" style={{ fontSize: 10.5 }}>{t.prazo.split("-").reverse().join("/")}</span>}
                </label>
              ))}
              <div className="row gap8" style={{ justifyContent: "flex-end", marginTop: 10 }}>
                <button className="btn btn-ghost" onClick={() => { setTarefas(null); setAba(null); }}>Descartar</button>
                <button className="btn btn-primary" disabled={criando || escolhidas.size === 0} onClick={criarTarefas}>
                  {criando ? "Criando…" : `Criar ${escolhidas.size} tarefa(s)`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
