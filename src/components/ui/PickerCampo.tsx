"use client";

// Seletor de lista longa em modal, no lugar de <select>.
// Motivo: a lista nativa estoura o card (a paleta Ctrl+K virava um paredão de
// 20 projetos por cima do formulário) e não dá pra buscar — com dezenas de
// projetos, achar o certo é rolagem cega.
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";

export type PickerOpcao = { id: string; nome: string; sub?: string };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function PickerCampo({
  label,
  valor,
  opcoes,
  onChange,
  vazioLabel,
  titulo,
  placeholderBusca = "Buscar…",
  vazioTexto = "(nenhuma opção)",
}: {
  label: string;
  valor: string;
  opcoes: PickerOpcao[];
  onChange: (id: string) => void;
  /** Rótulo da opção "nenhum". Omitir torna a escolha obrigatória. */
  vazioLabel?: string;
  titulo?: string;
  placeholderBusca?: string;
  /** Texto quando não há nenhuma opção cadastrada. */
  vazioTexto?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const atual = opcoes.find((o) => o.id === valor);
  const rotulo = atual?.nome ?? vazioLabel ?? vazioTexto;

  return (
    <div>
      <label className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{label}</label>
      <button
        type="button"
        className="input row gap8"
        onClick={() => setAberto(true)}
        style={{
          width: "100%",
          marginTop: 6,
          alignItems: "center",
          justifyContent: "space-between",
          textAlign: "left",
          cursor: "pointer",
          color: atual ? "var(--ink)" : "var(--muted)",
        }}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rotulo}</span>
        <Icon name="chevDown" size={15} />
      </button>

      {aberto && (
        <PickerModal
          titulo={titulo ?? label}
          valor={valor}
          opcoes={opcoes}
          vazioLabel={vazioLabel}
          vazioTexto={vazioTexto}
          placeholderBusca={placeholderBusca}
          onEscolher={(id) => {
            onChange(id);
            setAberto(false);
          }}
          onFechar={() => setAberto(false)}
        />
      )}
    </div>
  );
}

function PickerModal({
  titulo,
  valor,
  opcoes,
  vazioLabel,
  vazioTexto,
  placeholderBusca,
  onEscolher,
  onFechar,
}: {
  titulo: string;
  valor: string;
  opcoes: PickerOpcao[];
  vazioLabel?: string;
  vazioTexto: string;
  placeholderBusca: string;
  onEscolher: (id: string) => void;
  onFechar: () => void;
}) {
  const [q, setQ] = useState("");
  // Abre já no item escolhido, não no topo.
  const [sel, setSel] = useState(() => {
    const ids = vazioLabel ? ["", ...opcoes.map((o) => o.id)] : opcoes.map((o) => o.id);
    const i = ids.indexOf(valor);
    return i >= 0 ? i : 0;
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const pressedFora = useRef(false);

  const itens = useMemo(() => {
    const base: PickerOpcao[] = vazioLabel ? [{ id: "", nome: vazioLabel }, ...opcoes] : opcoes;
    const termo = semAcento(q.trim());
    if (!termo) return base;
    return base.filter((o) => semAcento(o.nome).includes(termo) || (o.sub ? semAcento(o.sub).includes(termo) : false));
  }, [q, opcoes, vazioLabel]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Mantém o item ativo visível na rolagem.
  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>("[data-ativo='1']")?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  // Este modal vive DENTRO da paleta: sem stopPropagation, o Esc daqui também
  // chegaria no handler dela e jogaria o usuário de volta pra busca.
  function onKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      onFechar();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => (itens.length ? (s + 1) % itens.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => (itens.length ? (s - 1 + itens.length) % itens.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = itens[sel];
      if (item) onEscolher(item.id);
    }
  }

  return (
    <div
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => { pressedFora.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => {
        if (pressedFora.current && e.target === e.currentTarget) onFechar();
        pressedFora.current = false;
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(16,24,40,.45)",
        zIndex: 500,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 480, padding: 0, overflow: "hidden", boxShadow: "var(--sh-lg)", display: "flex", flexDirection: "column", maxHeight: "70vh" }}
      >
        <div className="row between" style={{ alignItems: "center", padding: "14px 16px 10px" }}>
          <h3 className="card-title" style={{ fontSize: 15 }}>{titulo}</h3>
          <button className="icon-btn" style={{ border: "none", background: "none" }} onClick={onFechar} aria-label="Fechar">
            <Icon name="plus" size={18} style={{ transform: "rotate(45deg)" }} />
          </button>
        </div>

        <div className="row gap8" style={{ alignItems: "center", padding: "0 16px 12px" }}>
          <span className="muted"><Icon name="search" size={15} /></span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            placeholder={placeholderBusca}
            style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 14, color: "var(--ink)" }}
          />
        </div>

        <div ref={listaRef} style={{ borderTop: "1px solid var(--line)", overflowY: "auto" }}>
          {opcoes.length === 0 && <div className="muted" style={{ padding: "14px 16px", fontSize: 12.5 }}>{vazioTexto}</div>}
          {opcoes.length > 0 && itens.length === 0 && (
            <div className="muted" style={{ padding: "14px 16px", fontSize: 12.5 }}>Nada encontrado.</div>
          )}
          {itens.map((o, i) => (
            <div
              key={o.id || "__vazio"}
              data-ativo={sel === i ? "1" : "0"}
              onClick={() => onEscolher(o.id)}
              onMouseEnter={() => setSel(i)}
              className="row gap8"
              style={{
                alignItems: "center",
                padding: "9px 16px",
                cursor: "pointer",
                background: sel === i ? "var(--surface-2)" : "transparent",
                borderLeft: `2px solid ${sel === i ? "var(--primary)" : "transparent"}`,
              }}
            >
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {o.nome}
                </span>
                {o.sub && <span className="muted" style={{ fontSize: 11.5 }}>{o.sub}</span>}
              </span>
              {o.id === valor && <span style={{ color: "var(--primary)" }}><Icon name="check" size={15} /></span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
