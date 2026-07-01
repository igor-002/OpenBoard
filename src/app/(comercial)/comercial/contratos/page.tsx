import Link from "next/link";
import { getContratos, getContratoFiltroOpcoes } from "@/server/comercial/queries";
import { ContratosFilterBar } from "@/components/comercial/ContratosFilterBar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { STATUS_LABEL } from "@/lib/ixc";
import { brl, dayLabel } from "@/lib/format";

function statusTone(s: string): { c: string; bg: string } {
  if (s === "A") return { c: "var(--st-done)", bg: "var(--st-done-bg)" };
  if (s === "AA" || s === "P") return { c: "var(--st-progress)", bg: "var(--st-progress-bg)" };
  if (["C", "CN", "CA", "N"].includes(s)) return { c: "var(--st-risk)", bg: "var(--st-risk-bg)" };
  return { c: "var(--pr-med)", bg: "var(--pr-med-bg)" };
}

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; vendedor?: string; filial?: string; ini?: string; fim?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = sp.page ? parseInt(sp.page, 10) : 0;
  const [{ rows, total, pageSize }, opcoes] = await Promise.all([
    getContratos({ q: sp.q, status: sp.status, vendedorIxcId: sp.vendedor, filial: sp.filial, ini: sp.ini, fim: sp.fim, page }),
    getContratoFiltroOpcoes(),
  ]);

  const statusOptions = opcoes.status.map((s) => ({ value: s, label: STATUS_LABEL[s] ?? s }));
  const totalPages = Math.ceil(total / pageSize);
  const baseParams = new URLSearchParams();
  if (sp.q) baseParams.set("q", sp.q);
  if (sp.status) baseParams.set("status", sp.status);
  if (sp.vendedor) baseParams.set("vendedor", sp.vendedor);
  if (sp.filial) baseParams.set("filial", sp.filial);
  if (sp.ini) baseParams.set("ini", sp.ini);
  if (sp.fim) baseParams.set("fim", sp.fim);
  const pageHref = (p: number) => {
    const params = new URLSearchParams(baseParams);
    if (p > 0) params.set("page", String(p));
    const qs = params.toString();
    return `/comercial/contratos${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Contratos</h1>
          <p className="page-sub">{total.toLocaleString("pt-BR")} contratos · espelho IXC</p>
        </div>
      </div>

      <ContratosFilterBar vendedores={opcoes.vendedores} statusOptions={statusOptions} filiais={opcoes.filiais} />

      <div style={{ marginTop: "var(--gap)" }}>
        <Card title="Contratos" sub={`Página ${page + 1} de ${Math.max(1, totalPages)}`} pad={false}>
          {rows.length === 0 ? (
            <div className="card-pad muted">Nenhum contrato para os filtros aplicados.</div>
          ) : (
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Cliente</th>
                  <th style={{ textAlign: "left" }}>Contrato</th>
                  <th style={{ textAlign: "left" }}>Vendedor</th>
                  <th style={{ textAlign: "left" }}>Cadastro</th>
                  <th style={{ textAlign: "right" }}>MRR</th>
                  <th style={{ textAlign: "left" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const tone = statusTone(r.status);
                  return (
                    <tr key={r.ixcId}>
                      <td>
                        <div className="nm" style={{ fontWeight: 700 }}>{r.clienteNome}</div>
                        {r.uf && /^[A-Za-z]{2}$/.test(r.uf) && <div className="muted" style={{ fontSize: 12 }}>{r.uf.toUpperCase()}</div>}
                      </td>
                      <td className="muted" style={{ fontFamily: "monospace", fontSize: 12 }}>#{r.ixcId}</td>
                      <td>{r.vendedorNome ?? "—"}</td>
                      <td className="muted">{r.dataCadastro ? dayLabel(new Date(r.dataCadastro)) : "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{r.mrrCents ? brl(r.mrrCents) : "—"}</td>
                      <td>
                        <span className="badge" style={{ color: tone.c, background: tone.bg }}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {totalPages > 1 && (
        <div className="row gap12" style={{ marginTop: "var(--gap)", justifyContent: "center", alignItems: "center" }}>
          {page > 0 ? (
            <Link className="btn btn-ghost" href={pageHref(page - 1)}><Icon name="chevLeft" size={15} /> Anterior</Link>
          ) : (
            <span className="btn btn-ghost" style={{ opacity: 0.4, pointerEvents: "none" }}><Icon name="chevLeft" size={15} /> Anterior</span>
          )}
          <span className="muted" style={{ fontSize: 13 }}>{page + 1} / {totalPages}</span>
          {page < totalPages - 1 ? (
            <Link className="btn btn-ghost" href={pageHref(page + 1)}>Próxima <Icon name="chevRight" size={15} /></Link>
          ) : (
            <span className="btn btn-ghost" style={{ opacity: 0.4, pointerEvents: "none" }}>Próxima <Icon name="chevRight" size={15} /></span>
          )}
        </div>
      )}
    </div>
  );
}
