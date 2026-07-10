import { requireModule } from "@/lib/permissions";
import { getKanbanData } from "@/server/tasks";
import { KanbanBoard } from "@/components/task/KanbanBoard";

export default async function KanbanPage() {
  const user = await requireModule("gestao");
  const data = await getKanbanData(user.workspaceId);

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <KanbanBoard
        data={data}
        currentUser={{ id: user.id, name: user.name, initials: user.initials, color: user.color }}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
