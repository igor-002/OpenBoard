import { requireUser } from "@/lib/auth";
import { getBoard } from "@/server/marketing/board";
import { QuadroBoard } from "@/components/marketing/QuadroBoard";

export const dynamic = "force-dynamic";

// Quadro de Demandas do Marketing (Kanban tipo Trello) — fluxo próprio do time.
export default async function QuadroPage({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  await requireUser();
  const board = await getBoard();
  const { card } = await searchParams; // ?card=<id> (link da notificação de prazo) abre o card

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quadro de Demandas</h1>
          <p className="page-sub">
            Fluxo do marketing — cards internos e demandas do GLPI, com etiquetas e prazo. Arraste os cards entre as colunas.
          </p>
        </div>
      </div>
      <QuadroBoard board={board} openCardId={card ?? null} />
    </div>
  );
}
