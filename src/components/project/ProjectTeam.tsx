"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { addMember, removeMember } from "@/app/(app)/projects/actions";
import type { AvatarUser } from "@/lib/types";

type Member = AvatarUser & { id: string; jobTitle: string };

export function ProjectTeam({
  projectId,
  members,
  allUsers,
}: {
  projectId: string;
  members: Member[];
  allUsers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [picking, setPicking] = useState(false);

  const memberIds = new Set(members.map((m) => m.id));
  const candidates = allUsers.filter((u) => !memberIds.has(u.id));

  function add(userId: string) {
    if (!userId) return;
    start(async () => {
      await addMember(projectId, userId);
      setPicking(false);
      router.refresh();
    });
  }
  function rm(userId: string) {
    start(async () => {
      await removeMember(projectId, userId);
      router.refresh();
    });
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 16 }}>
        <h4 className="card-title" style={{ fontSize: 15 }}>Equipe do projeto</h4>
        {candidates.length > 0 && (
          <button className="btn btn-ghost" style={{ color: "var(--primary)" }} onClick={() => setPicking((p) => !p)}>
            <Icon name="plus" size={15} />
            Adicionar
          </button>
        )}
      </div>

      {picking && (
        <select className="input" defaultValue="" onChange={(e) => add(e.target.value)} style={{ marginBottom: 14 }}>
          <option value="" disabled>Escolher pessoa…</option>
          {candidates.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}

      {members.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>Sem membros ainda.</div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>
          {members.map((m) => (
            <div key={m.id} className="row gap12">
              <Avatar user={m} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{m.name}</b>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{m.jobTitle}</div>
              </div>
              <button onClick={() => rm(m.id)} title="Remover" style={{ border: "none", background: "none", color: "var(--muted-2)", cursor: "pointer", padding: 2 }}>
                <Icon name="plus" size={16} style={{ transform: "rotate(45deg)" }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
