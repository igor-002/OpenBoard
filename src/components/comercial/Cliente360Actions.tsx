"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { createOnboardingProject, linkProjectToCliente, criarTarefaCobranca } from "@/app/(comercial)/comercial/clientes/actions";

// B1 — cria projeto de implantação a partir do cliente.
export function OnboardingButton({ clienteIxcId }: { clienteIxcId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  function go() {
    setErr(null);
    start(async () => {
      const r = await createOnboardingProject(clienteIxcId);
      if (r.error) { setErr(r.error); return; }
      if (r.id) router.push(`/projects/${r.id}`);
      else router.refresh();
    });
  }
  return (
    <div className="row gap8" style={{ alignItems: "center" }}>
      {err && <span className="muted" style={{ fontSize: 12, color: "var(--st-risk)" }}>{err}</span>}
      <button className="btn btn-primary" onClick={go} disabled={pending}>
        <Icon name="plus" size={15} /> {pending ? "Criando…" : "Criar projeto de implantação"}
      </button>
    </div>
  );
}

// A2 — vincula um projeto existente do workspace ao cliente.
export function LinkProjectForm({ clienteIxcId, projetos }: { clienteIxcId: string; projetos: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState("");
  if (projetos.length === 0) return null;
  function vincular() {
    if (!sel) return;
    start(async () => { await linkProjectToCliente(sel, clienteIxcId); setSel(""); router.refresh(); });
  }
  return (
    <div className="row gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
      <select className="select-comercial" value={sel} onChange={(e) => setSel(e.target.value)} style={{ maxWidth: 260 }}>
        <option value="">Vincular projeto existente…</option>
        {projetos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button className="btn btn-ghost" onClick={vincular} disabled={pending || !sel}>Vincular</button>
    </div>
  );
}

export function UnlinkButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className="btn btn-ghost" disabled={pending} title="Desvincular do cliente" onClick={() => start(async () => { await linkProjectToCliente(projectId, null); router.refresh(); })}>
      Desvincular
    </button>
  );
}

// B2/B3 — cria tarefa de cobrança/retenção no projeto vinculado.
export function CobrancaForm({ projectId, tituloSugerido }: { projectId: string; tituloSugerido: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [titulo, setTitulo] = useState(tituloSugerido);
  const [msg, setMsg] = useState<string | null>(null);
  function criar() {
    setMsg(null);
    start(async () => {
      const r = await criarTarefaCobranca(projectId, titulo);
      setMsg(r.error ?? "Tarefa criada ✓");
      if (!r.error) router.refresh();
    });
  }
  return (
    <div className="row gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
      <input className="select-comercial" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={{ width: 240 }} placeholder="Título da tarefa" />
      <button className="btn btn-ghost" onClick={criar} disabled={pending}><Icon name="plus" size={14} /> Criar tarefa</button>
      {msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}
    </div>
  );
}
