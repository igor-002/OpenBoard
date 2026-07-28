import { requireUser } from "@/lib/auth";
import { getBoard } from "@/server/marketing/board";
import { QuadroBoard } from "@/components/marketing/QuadroBoard";

export const dynamic = "force-dynamic";

// Quadro de Demandas do Marketing (Kanban tipo Trello) — fluxo próprio do time.
export default async function QuadroPage({
  searchParams,
}: {
  searchParams: Promise<{ card?: string; concluidas?: string }>;
}) {
  await requireUser();
  // ?card=<id> (link da notificação de prazo) abre o card; ?concluidas=1 revela as
  // concluídas antigas, escondidas por padrão.
  const { card, concluidas } = await searchParams;
  const board = await getBoard({ includeDone: concluidas === "1" });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quadro de Demandas</h1>
          <p className="page-sub">
            Kanban único do marketing — chamados do GLPI entram sozinhos e convivem com os cards internos. Arrastar um
            chamado para uma coluna vinculada muda o status dele no GLPI.
          </p>
        </div>
      </div>
      <QuadroBoard board={board} openCardId={card ?? null} />
    </div>
  );
}
