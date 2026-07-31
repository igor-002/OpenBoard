"use client";

// Vincular nota a cliente. É BUSCA, não <select>: o espelho do IXC tem milhares
// de clientes e uma lista truncada só mostraria quem começa com "A".
// Reusa a mesma server action do seletor de /atividades.
import { useEffect, useRef, useState } from "react";
import { searchClientes, type ClienteHit } from "@/app/(app)/atividades/actions";

export function NotaClientePicker({
  clienteId,
  clienteNome,
  onChange,
}: {
  clienteId: string | null;
  clienteNome: string | null;
  onChange: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ClienteHit[]>([]);
  const [buscando, setBuscando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const termo = q.trim();
    if (termo.length < 2) return;
    timer.current = setTimeout(async () => {
      setBuscando(true);
      try {
        setHits(await searchClientes(termo));
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  // Deriva em vez de limpar por efeito: com termo curto (ou resultado ainda da
  // busca anterior) não mostra nada. Mesmo padrão da CommandPalette.
  const hitsVisiveis = q.trim().length < 2 ? [] : hits;

  if (clienteId) {
    return (
      <label className="notas-vinculo">
        <span className="muted">Cliente</span>
        <span className="notas-cliente-sel">
          <span title={clienteNome ?? ""}>{clienteNome ?? "cliente vinculado"}</span>
          <button type="button" className="btn btn-ghost" onClick={() => onChange(null)}>
            Tirar
          </button>
        </span>
      </label>
    );
  }

  return (
    <label className="notas-vinculo" style={{ position: "relative" }}>
      <span className="muted">Cliente</span>
      <input
        className="input"
        value={q}
        autoComplete="off"
        placeholder="buscar por nome ou CNPJ/CPF…"
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim().length >= 2 && (
        <div className="notas-cliente-hits card">
          {buscando && <div className="muted" style={{ padding: "6px 10px", fontSize: 12.5 }}>Buscando…</div>}
          {!buscando && hitsVisiveis.length === 0 && (
            <div className="muted" style={{ padding: "6px 10px", fontSize: 12.5 }}>Nenhum cliente encontrado.</div>
          )}
          {hitsVisiveis.map((h) => (
            <button
              key={h.id}
              type="button"
              className="notas-cliente-hit"
              onClick={() => {
                setQ("");
                onChange(h.id);
              }}
            >
              <b>{h.razao}</b>
              <span className="muted" style={{ fontSize: 11.5 }}>
                {h.ixcId ? ` · IXC ${h.ixcId}` : " · manual"}
                {h.cnpjCpf ? ` · ${h.cnpjCpf}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}
