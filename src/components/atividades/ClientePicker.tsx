"use client";

// Seletor de cliente/dono da atividade: busca no espelho local (IXC + manuais)
// por razão, CNPJ/CPF ou código IXC; permite cadastrar cliente manual na hora.
import { useEffect, useRef, useState, useTransition } from "react";
import { searchClientes, createClienteManual, type ClienteHit } from "@/app/(app)/atividades/actions";

export function ClientePicker({ name = "ixcClienteId" }: { name?: string }) {
  const [selected, setSelected] = useState<ClienteHit | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ClienteHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Busca com debounce (300ms).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        setHits(await searchClientes(term));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  if (selected) {
    return (
      <div className="field">
        <label>Cliente / dono da demanda</label>
        <input type="hidden" name={name} value={selected.id} />
        <div className="row between" style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "8px 12px", background: "var(--surface-3)" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>
            {selected.razao}
            {selected.ixcId && <span className="muted" style={{ fontWeight: 500 }}> · IXC {selected.ixcId}</span>}
            {!selected.ixcId && <span className="muted" style={{ fontWeight: 500 }}> · manual</span>}
          </span>
          <button type="button" className="btn" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => { setSelected(null); setQ(""); }}>
            Trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="field" style={{ position: "relative" }}>
      <label htmlFor="cliente-q">Cliente / dono da demanda (opcional)</label>
      <input
        className="input"
        id="cliente-q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por razão, CNPJ/CPF ou código IXC…"
        autoComplete="off"
      />
      {q.trim().length >= 2 && !creating && (
        <div className="card" style={{ padding: 6, marginTop: 6, maxHeight: 220, overflowY: "auto", boxShadow: "var(--sh-md)" }}>
          {searching && <div className="muted" style={{ fontSize: 13, padding: "6px 10px" }}>Buscando…</div>}
          {!searching && hits.length === 0 && (
            <div className="muted" style={{ fontSize: 13, padding: "6px 10px" }}>Nenhum cliente encontrado.</div>
          )}
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setSelected(h)}
              style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "none", padding: "8px 10px", borderRadius: "var(--r-xs)", cursor: "pointer", fontSize: 13.5 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <b>{h.razao}</b>
              <span className="muted" style={{ fontSize: 12 }}>
                {" "}
                {h.ixcId ? `· IXC ${h.ixcId}` : "· manual"}
                {h.cnpjCpf ? ` · ${h.cnpjCpf}` : ""}
              </span>
            </button>
          ))}
          <button
            type="button"
            className="btn"
            style={{ width: "100%", marginTop: 4, fontSize: 13 }}
            onClick={() => setCreating(true)}
          >
            ＋ Cadastrar cliente &quot;{q.trim()}&quot;
          </button>
        </div>
      )}
      {creating && (
        <NovoClienteInline
          razaoInicial={q.trim()}
          onCreated={(c) => { setSelected(c); setCreating(false); }}
          onCancel={() => setCreating(false)}
        />
      )}
    </div>
  );
}

// Mini-form SEM <form> aninhado (o picker vive dentro do form da atividade):
// campos controlados + chamada direta da server action.
function NovoClienteInline({ razaoInicial, onCreated, onCancel }: { razaoInicial: string; onCreated: (c: ClienteHit) => void; onCancel: () => void }) {
  const [razao, setRazao] = useState(razaoInicial);
  const [doc, setDoc] = useState("");
  const [uf, setUf] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const fd = new FormData();
      fd.set("razao", razao);
      fd.set("cnpjCpf", doc);
      fd.set("uf", uf);
      const res = await createClienteManual({}, fd);
      if (res.ok && res.cliente) onCreated(res.cliente);
      else setError(res.error ?? "Erro ao salvar.");
    });
  }

  return (
    <div className="card" style={{ padding: 12, marginTop: 6, boxShadow: "var(--sh-md)", display: "flex", flexDirection: "column", gap: 10 }}>
      <b style={{ fontSize: 13 }}>Cadastrar cliente manual</b>
      <div className="field">
        <label htmlFor="nc-razao">Nome / razão social</label>
        <input className="input" id="nc-razao" value={razao} onChange={(e) => setRazao(e.target.value)} autoFocus />
      </div>
      <div className="row gap8">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="nc-doc">CNPJ/CPF (opcional)</label>
          <input className="input" id="nc-doc" value={doc} onChange={(e) => setDoc(e.target.value)} />
        </div>
        <div className="field" style={{ width: 70 }}>
          <label htmlFor="nc-uf">UF</label>
          <input className="input" id="nc-uf" value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} />
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="row gap8" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={pending}>
          {pending ? "Salvando…" : "Salvar cliente"}
        </button>
      </div>
    </div>
  );
}
