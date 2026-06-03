"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { ProjectForm } from "./ProjectForm";
import { createProject } from "@/app/(app)/projects/actions";

export function NewProjectButton({ users }: { users: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} />
        Novo projeto
      </button>
      {open && (
        <Modal title="Novo projeto" onClose={() => setOpen(false)} maxWidth={540}>
          <ProjectForm
            action={createProject}
            users={users}
            submitLabel="Criar projeto"
            onDone={(id) => {
              setOpen(false);
              if (id) router.push(`/projects/${id}`);
              else router.refresh();
            }}
          />
        </Modal>
      )}
    </>
  );
}
