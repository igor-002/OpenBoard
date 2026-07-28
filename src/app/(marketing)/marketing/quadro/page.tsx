import { requireUser } from "@/lib/auth";
import { getBoard } from "@/server/marketing/board";
import { glpiConfigured } from "@/server/glpi/queries";
import { getTrackedUsers, getAssignableUsers } from "@/server/glpi/users";
import { v1ListCategories } from "@/lib/glpi-v1";
import { QuadroBoard } from "@/components/marketing/QuadroBoard";
import { NovaDemanda } from "@/components/marketing/NovaDemanda";

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
  // Abrir chamado direto do quadro usa o MESMO modal de /marketing/demandas — um
  // formulário só pra demanda do GLPI, em vez de dois jeitos diferentes de criar.
  const glpiOn = glpiConfigured();
  const [board, trackedUsers, assignable, categorias] = await Promise.all([
    getBoard({ includeDone: concluidas === "1" }),
    glpiOn ? getTrackedUsers() : [],
    glpiOn ? getAssignableUsers() : [],
    glpiOn ? v1ListCategories() : [],
  ]);

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
        {trackedUsers.length > 0 && (
          <NovaDemanda trackedUsers={trackedUsers} assignable={assignable} categorias={categorias} irParaDetalhe={false} />
        )}
      </div>
      <QuadroBoard board={board} openCardId={card ?? null} />
    </div>
  );
}
