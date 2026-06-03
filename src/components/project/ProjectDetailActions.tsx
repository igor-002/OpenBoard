"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ProjectForm } from "./ProjectForm";
import { updateProject, deleteProject } from "@/app/(app)/projects/actions";
import type { ProjectEdit } from "@/server/projects";

export function ProjectDetailActions({
  project,
  users,
}: {
  project: ProjectEdit;
  users: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onConfirmDelete() {
    start(() => {
      void deleteProject(project.id); // redireciona para /projects no servidor
    });
  }

  return (
    <>
      <div className="row gap8">
        <button className="btn" onClick={() => setOpen(true)}>
          <Icon name="settings" size={15} />
          Editar
        </button>
        <button className="btn" style={{ color: "var(--st-risk)" }} onClick={() => setConfirming(true)} disabled={pending}>
          <Icon name="alert" size={15} />
          Excluir
        </button>
      </div>

      {confirming && (
        <ConfirmModal
          danger
          title="Excluir projeto?"
          confirmLabel="Excluir projeto"
          pending={pending}
          onConfirm={onConfirmDelete}
          onClose={() => setConfirming(false)}
          message={
            <>
              O projeto <b style={{ color: "var(--ink)" }}>{project.name}</b> e tudo ligado a ele
              (tarefas, marcos, observações e apontamentos de tempo) serão removidos.
              <br />
              Esta ação não pode ser desfeita.
            </>
          }
        />
      )}

      {open && (
        <Modal title="Editar projeto" onClose={() => setOpen(false)} maxWidth={540}>
          <ProjectForm
            action={updateProject.bind(null, project.id)}
            users={users}
            initial={project}
            submitLabel="Salvar alterações"
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </Modal>
      )}
    </>
  );
}
