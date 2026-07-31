import { requireTool } from "@/lib/permissions";
import { getNota, listarNotas, opcoesVinculo, tagsDoUsuario } from "@/server/notas";
import { getOpenAIConfig } from "@/server/settings";
import { openaiConfigured } from "@/lib/openai";
import { NotasView } from "@/components/notas/NotasView";

export default async function NotasPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string; projeto?: string }>;
}) {
  const user = await requireTool("gestao.notas");
  const { n, projeto } = await searchParams;

  const [notas, notaInicial, opcoes, tags, cfg] = await Promise.all([
    listarNotas(user.workspaceId, user.id),
    n ? getNota(user.id, n) : Promise.resolve(null),
    opcoesVinculo(user.workspaceId, user.id),
    tagsDoUsuario(user.workspaceId, user.id),
    getOpenAIConfig(),
  ]);

  return (
    <div className="page">
      <div className="row between" style={{ alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Notas</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Suas anotações. Só você vê — quem mais pode ver é quem você escolher em “Compartilhar”.
          </p>
        </div>
      </div>

      <NotasView
        notas={notas}
        notaInicial={notaInicial}
        opcoes={opcoes}
        tags={tags}
        ehAdmin={user.role === "admin"}
        iaConfigurada={openaiConfigured(cfg)}
        projetoPreSelecionado={projeto ?? null}
      />
    </div>
  );
}
