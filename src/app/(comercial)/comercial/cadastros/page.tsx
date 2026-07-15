import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Icon } from "@/components/ui/Icon";
import { listSolicitacoes, countSolicitacoesPorStatus } from "@/server/comercial/cadastros";
import { isSolicitacaoStatus, type SolicitacaoStatus } from "@/lib/cadastros";
import { CadastrosQueue } from "@/components/comercial/CadastrosQueue";
import { AutoRefresh } from "@/components/common/AutoRefresh";

export const dynamic = "force-dynamic";

// Fila de solicitações de cadastro (recebidas pelo form público /solicitar-cadastro).
export default async function CadastrosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireUser();
  const { status } = await searchParams;
  const ativo: SolicitacaoStatus = isSolicitacaoStatus(status) ? status : "pendente";
  const [itens, counts] = await Promise.all([listSolicitacoes(ativo), countSolicitacoesPorStatus()]);

  return (
    <div className="page">
      {/* solicitações chegam de fora (form público) → revalida sozinho */}
      <AutoRefresh seconds={30} />
      <div className="page-head">
        <div style={{ flex: 1, minWidth: 260, maxWidth: 640 }}>
          <h1 className="page-title">Cadastros</h1>
          <p className="page-sub">
            Solicitações de cadastro de clientes enviadas pelo formulário público. Urgentes e com prazo
            próximo sobem pro topo da fila.
          </p>
        </div>
        {/* Link (não <a>) pra respeitar o basePath no deploy */}
        <Link className="btn btn-primary" href="/solicitar-cadastro" target="_blank" rel="noreferrer">
          <Icon name="externalLink" size={15} /> Formulário público
        </Link>
      </div>
      <CadastrosQueue itens={itens} ativo={ativo} counts={counts} />
    </div>
  );
}
