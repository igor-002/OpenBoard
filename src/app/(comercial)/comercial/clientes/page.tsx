import Link from "next/link";
import { getClientes } from "@/server/comercial/queries";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { brl } from "@/lib/format";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = sp.page ? parseInt(sp.page, 10) : 0;
  const { rows, total, pageSize } = await getClientes({ q: sp.q, page });
  const totalPages = Math.ceil(total / pageSize);

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (p > 0) params.set("page", String(p));
    const qs = params.toString();
    return `/comercial/clientes${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-sub">{total.toLocaleString("pt-BR")} clientes com contrato · visão 360 (IXC + projetos)</p>
        </div>
      </div>

      <form className="card card-pad row gap8" style={{ alignItems: "center", background: "var(--surface-3)" }}>
        <Icon name="search" size={15} style={{ color: "var(--muted)" }} />
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar por razão, CNPJ/CPF ou ID IXC…" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14 }} />
        {sp.q && <Link className="btn btn-ghost" href="/comercial/clientes">Limpar</Link>}
        <button className="btn btn-primary" type="submit">Buscar</button>
      </form>

      <div style={{ marginTop: "var(--gap)" }}>
        <Card title="Clientes" sub={totalPages > 1 ? `Página ${page + 1} de ${totalPages}` : undefined} pad={false}>
          {rows.length === 0 ? (
            <div className="card-pad muted">Nenhum cliente para o filtro.</div>
          ) : (
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Cliente</th>
                  <th style={{ textAlign: "right" }}>Contratos</th>
                  <th style={{ textAlign: "right" }}>Ativos</th>
                  <th style={{ textAlign: "right" }}>MRR ativo</th>
                  <th style={{ textAlign: "right" }}>Projetos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.ixcId}>
                    <td>
                      <Link href={`/comercial/clientes/${c.ixcId}`} style={{ fontWeight: 700, color: "var(--ink)" }}>{c.razao}</Link>
                      {c.uf && /^[A-Za-z]{2}$/.test(c.uf) && <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{c.uf.toUpperCase()}</span>}
                    </td>
                    <td style={{ textAlign: "right" }} className="muted">{c.contratos}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: c.ativos ? "var(--st-done)" : "var(--muted)" }}>{c.ativos}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{c.mrrAtivoCents ? brl(c.mrrAtivoCents) : "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {c.projetos > 0 ? <span className="badge" style={{ color: "var(--primary)", background: "var(--pr-low-bg, var(--surface-3))" }}>{c.projetos}</span> : <span className="muted">—</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link className="btn btn-ghost" href={`/comercial/clientes/${c.ixcId}`}>Ver 360 <Icon name="chevRight" size={14} /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {totalPages > 1 && (
        <div className="row gap12" style={{ marginTop: "var(--gap)", justifyContent: "center", alignItems: "center" }}>
          {page > 0 ? <Link className="btn btn-ghost" href={pageHref(page - 1)}><Icon name="chevLeft" size={15} /> Anterior</Link> : <span className="btn btn-ghost" style={{ opacity: 0.4, pointerEvents: "none" }}><Icon name="chevLeft" size={15} /> Anterior</span>}
          <span className="muted" style={{ fontSize: 13 }}>{page + 1} / {totalPages}</span>
          {page < totalPages - 1 ? <Link className="btn btn-ghost" href={pageHref(page + 1)}>Próxima <Icon name="chevRight" size={15} /></Link> : <span className="btn btn-ghost" style={{ opacity: 0.4, pointerEvents: "none" }}>Próxima <Icon name="chevRight" size={15} /></span>}
        </div>
      )}
    </div>
  );
}
