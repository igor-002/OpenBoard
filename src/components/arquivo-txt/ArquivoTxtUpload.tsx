"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { withBasePath } from "@/lib/basePath";

type Atual = {
  versao: string;
  nome: string;
  tamanho: number;
  linhas: number;
  enviadoEm: string;
  aplicadoEm: string | null;
  aplicadoPor: string | null;
  previa: string[];
};

const ERROS: Record<string, string> = {
  chave_invalida: "Link inválido. Peça o link correto pra quem administra.",
  muitas_tentativas: "Muitas tentativas com link errado. Espere 15 minutos.",
  nao_configurado: "A página ainda não foi configurada no servidor.",
};

const fmtHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtTamanho = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

// Sobe o .txt que substitui o 009.txt da pasta kali009 no PC. O PC puxa sozinho
// (script agendado); a página acompanha até ele confirmar que gravou.
export function ArquivoTxtUpload({ chave }: { chave: string }) {
  const [atual, setAtual] = useState<Atual | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [erroChave, setErroChave] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const q = `?key=${encodeURIComponent(chave)}`;

  const carregar = useCallback(async () => {
    const r = await fetch(withBasePath(`/api/arquivo-txt${q}`), { cache: "no-store" }).catch(() => null);
    if (!r) return;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErroChave(ERROS[j.error] ?? "Não foi possível falar com o servidor.");
    } else {
      setErroChave(null);
      setAtual(j.atual);
    }
    setCarregado(true);
  }, [q]);

  useEffect(() => {
    if (!chave) return;
    const t0 = setTimeout(carregar, 0);
    const t = setInterval(carregar, 5000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [chave, carregar]);

  const enviar = async () => {
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    const fd = new FormData();
    fd.append("arquivo", arquivo);
    const r = await fetch(withBasePath(`/api/arquivo-txt${q}`), { method: "POST", body: fd }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!r || !r.ok) {
      setErro(ERROS[j.error] ?? j.error ?? "Falha ao enviar. Tente de novo.");
      return;
    }
    setArquivo(null);
    if (inputRef.current) inputRef.current.value = "";
    carregar();
  };

  if (!chave || erroChave) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <Icon name="alert" size={30} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "12px 0 6px" }}>Acesso negado</h1>
        <p className="page-sub">{erroChave ?? ERROS.chave_invalida}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>Atualizar 009.txt</h1>
      <p className="page-sub" style={{ marginBottom: 20 }}>
        O arquivo enviado aqui substitui o <b>009.txt</b> da pasta kali009 do computador. O nome do seu arquivo não
        importa: ele sempre vira 009.txt.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          className="input"
          onChange={(e) => {
            setErro(null);
            setArquivo(e.target.files?.[0] ?? null);
          }}
        />
        <button className="btn btn-primary" type="button" disabled={!arquivo || enviando} onClick={enviar}>
          {enviando ? "Enviando…" : "Enviar e substituir"}
        </button>
        {erro && (
          <p role="alert" style={{ color: "var(--st-risk)", margin: 0, fontSize: 13 }}>
            {erro}
          </p>
        )}
      </div>

      <div style={{ marginTop: 24, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", opacity: 0.6, marginBottom: 8 }}>
          Versão atual
        </div>
        {!carregado ? (
          <p className="page-sub">Carregando…</p>
        ) : !atual ? (
          <p className="page-sub">Nenhum arquivo enviado ainda.</p>
        ) : (
          <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
            <div>
              <b>{atual.nome}</b> · {atual.linhas.toLocaleString("pt-BR")} linhas · {fmtTamanho(atual.tamanho)}
            </div>
            <div>Enviado em {fmtHora(atual.enviadoEm)}</div>
            {atual.aplicadoEm ? (
              <div style={{ color: "var(--st-done)", display: "flex", gap: 6, alignItems: "center" }}>
                <Icon name="checkCircle" size={16} /> Gravado na pasta em {fmtHora(atual.aplicadoEm)}
                {atual.aplicadoPor ? ` (${atual.aplicadoPor})` : ""}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, alignItems: "center", opacity: 0.8 }}>
                <Icon name="clock" size={16} /> Aguardando o computador gravar na pasta
              </div>
            )}
            {atual.previa.length > 0 && (
              <pre
                style={{
                  margin: 0,
                  padding: 10,
                  fontSize: 12,
                  background: "var(--st-planned-bg)",
                  borderRadius: 6,
                  overflowX: "auto",
                  whiteSpace: "pre",
                }}
              >
                {atual.previa.join("\n")}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
