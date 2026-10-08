"use client";

// Regras de chamado GLPI: cada regra diz QUANDO uma demanda abre chamado no GLPI
// do Marketing (gatilho) e COM O QUÊ (técnico, requerente, categoria, tipo).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { emitToast } from "@/lib/toast";
import { salvarRegra, excluirRegra, type RegraInput } from "@/app/(app)/settings/glpi/actions";
import type { RegraGlpi } from "@/server/glpi/regras";

type Opt = { id: string; name: string };
type OptGlpi = { id: number; name: string };
type Listas = { tipos: Opt[]; usuarios: Opt[]; usuariosGlpi: OptGlpi[]; categorias: OptGlpi[] };

const NOVA: RegraInput = {
  name: "",
  active: true,
  tipoId: null,
  assigneeId: null,
  glpiAssigneeId: null,
  glpiRequesterId: null,
  glpiCategoryId: null,
  glpiType: 2,
  fecharJunto: true,
};

export function GlpiRegrasManager({ ligado, regras, ...listas }: { ligado: boolean; regras: RegraGlpi[] } & Listas) {
  const router = useRouter();
  // id da regra em edição, "nova" pro formulário de criação, null = nada aberto.
  const [aberta, setAberta] = useState<string | null>(regras.length === 0 ? "nova" : null);
  const [pending, start] = useTransition();
  const ativas = regras.filter((r) => r.active).length;

  const nomeDe = (lista: { id: string | number; name: string }[], id: string | number | null) =>
    id == null ? null : (lista.find((x) => x.id === id)?.name ?? "(removido)");

  function salvar(input: RegraInput) {
    start(async () => {
      const r = await salvarRegra(input);
      if (r.error) return emitToast({ variant: "error", title: r.error });
      emitToast({ variant: "success", title: input.id ? "Regra atualizada" : "Regra criada" });
      setAberta(null);
      router.refresh();
    });
  }

  function excluir(r: RegraGlpi) {
    start(async () => {
      const res = await excluirRegra(r.id);
      if (res.error) return emitToast({ variant: "error", title: res.error });
      emitToast({ variant: "success", title: `Regra "${r.name}" excluída` });
      setAberta(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Chamados no GLPI</h1>
          <p className="page-sub">
            {ativas} {ativas === 1 ? "regra ativa" : "regras ativas"} · demanda que casa com uma regra abre chamado no GLPI do Marketing sozinha
          </p>
        </div>
        {aberta !== "nova" && (
          <button className="btn btn-primary" onClick={() => setAberta("nova")}>
            <Icon name="plus" size={16} />
            Nova regra
          </button>
        )}
      </div>

      {!ligado && (
        <div className="form-error" style={{ marginBottom: 16 }}>
          GLPI não configurado neste servidor (variáveis GLPI_*). Dá pra montar as regras, mas nenhum chamado é aberto e as listas de técnico e
          categoria ficam vazias.
        </div>
      )}

      {aberta === "nova" && (
        <Card title="Nova regra" style={{ marginBottom: "var(--gap)" }}>
          <RegraForm inicial={NOVA} listas={listas} pending={pending} onSalvar={salvar} onFechar={regras.length ? () => setAberta(null) : undefined} />
        </Card>
      )}

      <Card pad={false}>
        <table className="tbl" style={{ marginTop: 6 }}>
          <thead>
            <tr>
              <th>Regra</th>
              <th>Quando</th>
              <th>Chamado</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {regras.map((r) => {
              const quando = [
                r.tipoId ? `tipo ${nomeDe(listas.tipos, r.tipoId)}` : null,
                r.assigneeId ? `responsável ${nomeDe(listas.usuarios, r.assigneeId)}` : null,
              ].filter(Boolean);
              const chamado = [
                r.glpiAssigneeId ? `para ${nomeDe(listas.usuariosGlpi, r.glpiAssigneeId)}` : "sem técnico",
                nomeDe(listas.categorias, r.glpiCategoryId),
                r.fecharJunto ? "fecha a demanda junto" : null,
              ].filter(Boolean);
              return aberta === r.id ? (
                <tr key={r.id}>
                  <td colSpan={5} style={{ padding: 18 }}>
                    <RegraForm
                      inicial={r}
                      listas={listas}
                      pending={pending}
                      onSalvar={salvar}
                      onFechar={() => setAberta(null)}
                      onExcluir={() => excluir(r)}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={r.id} style={r.active ? undefined : { opacity: 0.55 }}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>{quando.length ? quando.join(" + ") : <span className="muted">Só quando escolhida na demanda</span>}</td>
                  <td>{chamado.join(" · ")}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {r.active ? "Ativa" : "Desativada"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn" style={{ padding: "5px 12px", fontSize: 12 }} disabled={pending} onClick={() => setAberta(r.id)}>
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
            {regras.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ padding: 20 }}>
                  Nenhuma regra ainda. Sem regra, nenhuma demanda abre chamado no GLPI.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function RegraForm({
  inicial,
  listas,
  pending,
  onSalvar,
  onFechar,
  onExcluir,
}: {
  inicial: RegraInput;
  listas: Listas;
  pending: boolean;
  onSalvar: (r: RegraInput) => void;
  onFechar?: () => void;
  onExcluir?: () => void;
}) {
  const [r, setR] = useState<RegraInput>(inicial);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const set = (campos: Partial<RegraInput>) => setR((v) => ({ ...v, ...campos }));
  const num = (v: string) => (v ? Number(v) : null);
  const soManual = !r.tipoId && !r.assigneeId;

  return (
    <form
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar(r);
      }}
    >
      <div className="field" style={{ marginBottom: 0, maxWidth: 420 }}>
        <label htmlFor="gr-name">Nome da regra</label>
        <input
          className="input"
          id="gr-name"
          value={r.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Ex.: Arte para o Marketing"
          required
          minLength={2}
          maxLength={80}
        />
      </div>

      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 13.5, fontWeight: 650, marginBottom: 8 }}>Quando abrir o chamado</legend>
        <div className="row gap12" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <Select rotulo="Tipo da demanda" valor={r.tipoId ?? ""} vazio="Qualquer tipo" opcoes={listas.tipos} onChange={(v) => set({ tipoId: v || null })} />
          <Select
            rotulo="Responsável da demanda"
            valor={r.assigneeId ?? ""}
            vazio="Qualquer pessoa"
            opcoes={listas.usuarios}
            onChange={(v) => set({ assigneeId: v || null })}
          />
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
          {soManual
            ? "Sem tipo nem responsável, a regra não dispara sozinha: fica como opção na hora de abrir a demanda."
            : r.tipoId && r.assigneeId
              ? "Dispara quando a demanda tem esse tipo E está com essa pessoa."
              : "Dispara sozinha toda vez que a demanda casar. Também dá pra escolher à mão."}
        </p>
      </fieldset>

      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 13.5, fontWeight: 650, marginBottom: 8 }}>Como o chamado nasce no GLPI</legend>
        <div className="row gap12" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <Select
            rotulo="Técnico atribuído"
            valor={String(r.glpiAssigneeId ?? "")}
            vazio="Ninguém (fica na fila)"
            opcoes={listas.usuariosGlpi}
            onChange={(v) => set({ glpiAssigneeId: num(v) })}
          />
          <Select
            rotulo="Requerente"
            valor={String(r.glpiRequesterId ?? "")}
            vazio="Usuário da integração"
            opcoes={listas.usuariosGlpi}
            onChange={(v) => set({ glpiRequesterId: num(v) })}
          />
          <Select
            rotulo="Categoria"
            valor={String(r.glpiCategoryId ?? "")}
            vazio="Sem categoria"
            opcoes={listas.categorias}
            onChange={(v) => set({ glpiCategoryId: num(v) })}
          />
          <Select
            rotulo="Tipo do chamado"
            valor={String(r.glpiType)}
            opcoes={[
              { id: 2, name: "Requisição" },
              { id: 1, name: "Incidente" },
            ]}
            onChange={(v) => set({ glpiType: Number(v) })}
          />
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
          Título, descrição, prazo e urgência vêm da própria demanda (prioridade alta = urgência alta).
        </p>
      </fieldset>

      <label className="row gap8" style={{ fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>
        <input type="checkbox" checked={r.fecharJunto} onChange={(e) => set({ fecharJunto: e.target.checked })} />
        Quando o chamado for solucionado no GLPI, resolver a demanda com a solução de lá
      </label>
      <label className="row gap8" style={{ fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>
        <input type="checkbox" checked={r.active} onChange={(e) => set({ active: e.target.checked })} />
        Regra ativa
      </label>

      <div className="row gap12" style={{ alignItems: "center", flexWrap: "wrap" }}>
        {onExcluir &&
          (confirmaExcluir ? (
            <>
              <span className="muted" style={{ fontSize: 12.5 }}>
                Excluir a regra? Chamados já abertos continuam.
              </span>
              <button type="button" className="btn" style={{ color: "var(--st-risk)" }} disabled={pending} onClick={onExcluir}>
                Excluir de vez
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmaExcluir(true)}>
              Excluir
            </button>
          ))}
        <span style={{ flex: 1 }} />
        {onFechar && (
          <button type="button" className="btn" onClick={onFechar}>
            Fechar
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar regra"}
        </button>
      </div>
    </form>
  );
}

function Select({
  rotulo,
  valor,
  vazio,
  opcoes,
  onChange,
}: {
  rotulo: string;
  valor: string;
  vazio?: string;
  opcoes: { id: string | number; name: string }[];
  onChange: (v: string) => void;
}) {
  // Valor salvo que saiu da lista (usuário removido do GLPI, tipo desativado)
  // continua visível, senão o select mostraria outra opção sem ninguém ter mudado.
  const orfao = valor && !opcoes.some((o) => String(o.id) === valor);
  return (
    <label className="field" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 5 }}>{rotulo}</span>
      <select className="input" value={valor} onChange={(e) => onChange(e.target.value)}>
        {vazio && <option value="">{vazio}</option>}
        {orfao && <option value={valor}>(não está mais na lista)</option>}
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
