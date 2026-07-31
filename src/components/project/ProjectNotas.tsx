// Aba "Notas" do projeto. Server component de propósito: não carrega TipTap —
// aqui só se lê o resumo em texto puro e clica pra abrir em /notas.
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { NoteListItem } from "@/server/notas";

export function ProjectNotas({ projectId, notas }: { projectId: string; notas: NoteListItem[] }) {
  return (
    <div>
      <div className="row between" style={{ alignItems: "center", marginBottom: 12 }}>
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0, maxWidth: 560 }}>
          Aqui aparecem as <strong>suas</strong> notas deste projeto e as que compartilharam com você.
          Notas privadas de outras pessoas não são listadas — nem para admin.
        </p>
        <Link className="btn btn-ghost" href={`/notas?projeto=${projectId}`}>
          <Icon name="plus" size={15} /> Nova nota
        </Link>
      </div>

      {notas.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhuma nota sua neste projeto ainda.</p>
      ) : (
        <div className="notas-projeto">
          {notas.map((n) => (
            <Link key={n.id} href={`/notas?n=${n.id}`} className="notas-projeto-card">
              <span className="row between" style={{ alignItems: "center", gap: 8 }}>
                <span className="notas-item-titulo">{n.title || "Sem título"}</span>
                {n.pinned && <Icon name="pin" size={13} />}
              </span>
              {n.resumo && <span className="notas-item-resumo">{n.resumo}</span>}
              <span className="notas-item-rodape">
                <span>{n.updatedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                {n.daOutraPessoa && <span className="tag" style={{ fontSize: 10 }}>de {n.autorNome.split(" ")[0]}</span>}
                {n.tags.map((t) => (
                  <span key={t} className="tag" style={{ fontSize: 10 }}>#{t}</span>
                ))}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
