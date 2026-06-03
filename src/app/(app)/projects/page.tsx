import { requireUser } from "@/lib/auth";
import { getProjectsList } from "@/server/projects";
import { getUsers } from "@/server/users";
import { ProjectsList } from "@/components/project/ProjectsList";
import { NewProjectButton } from "@/components/project/NewProjectButton";

export default async function ProjectsPage() {
  const user = await requireUser();
  const [projects, users] = await Promise.all([
    getProjectsList(user.workspaceId),
    getUsers(user.workspaceId),
  ]);
  const memberOpts = users.map((u) => ({ id: u.id, name: u.name }));

  const active = projects.filter((p) => p.status === "progress").length;
  const review = projects.filter((p) => p.status === "review").length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Projetos</h1>
          <p className="page-sub">
            {projects.length} projetos · {active} ativos · {review} em revisão
          </p>
        </div>
        <div className="row gap12">
          <NewProjectButton users={memberOpts} />
        </div>
      </div>

      <ProjectsList projects={projects} />
    </div>
  );
}
