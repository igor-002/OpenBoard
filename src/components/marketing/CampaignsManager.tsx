"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { fullLabel } from "@/lib/format";
import {
  createCampaignAction,
  renameCampaignAction,
  deleteCampaignAction,
} from "@/app/(marketing)/marketing/links/actions";

interface CampaignRow {
  id: string;
  name: string;
  links: number;
  createdAt: string;
}

export function CampaignsManager({ campaigns }: { campaigns: CampaignRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renameFor, setRenameFor] = useState<CampaignRow | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function run(fn: () => Promise<{ ok?: boolean; error?: string }>, onOk?: () => void) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.ok) {
        onOk?.();
        router.refresh();
      } else {
        setMsg(r.error ?? "Erro inesperado.");
      }
    });
  }

  return (
    <>
      <div className="row gap12" style={{ alignItems: "center", marginBottom: "var(--gap)" }}>
        <Link href="/marketing/links" className="btn btn-ghost">
          <Icon name="chevLeft" size={15} /> Voltar pros links
        </Link>
        {msg && <span className="muted" style={{ fontSize: 12.5 }}>{msg}</span>}
      </div>

      <Card title="Nova campanha" pad>
        <div className="row gap12">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder='Ex.: "Panfletagem julho 2026"'
            className="input"
            style={{ flex: 1, maxWidth: 320 }}
          />
          <button
            className="btn btn-ghost"
            disabled={pending || !newName.trim()}
            onClick={() => run(() => createCampaignAction(newName), () => setNewName(""))}
          >
            <Icon name="plus" size={15} /> Adicionar
          </button>
        </div>
      </Card>

      <Card pad={false} style={{ marginTop: "var(--gap)" }}>
        {campaigns.length === 0 ? (
          <div className="muted" style={{ padding: 24, textAlign: "center" }}>Nenhuma campanha ainda.</div>
        ) : (
          <table className="tbl" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Campanha</th>
                <th style={{ textAlign: "right" }}>Links</th>
                <th style={{ textAlign: "left" }}>Criada</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700 }}>{c.name}</td>
                  <td style={{ textAlign: "right" }}>{c.links}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{fullLabel(new Date(c.createdAt))}</td>
                  <td>
                    <div className="row gap8" style={{ justifyContent: "flex-end" }}>
                      <button
                        className="icon-btn"
                        title="Renomear"
                        onClick={() => {
                          setRenameFor(c);
                          setRenameValue(c.name);
                        }}
                      >
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Excluir"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`Excluir a campanha "${c.name}"? Os links dela ficam sem campanha (não são apagados).`)) {
                            run(() => deleteCampaignAction(c.id));
                          }
                        }}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {renameFor && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setRenameFor(null)}
        >
          <div className="card card-pad" style={{ width: 380, maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title" style={{ marginBottom: 12 }}>Renomear campanha</h3>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="input"
              style={{ width: "100%", marginBottom: 12 }}
            />
            <div className="row gap8" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setRenameFor(null)} disabled={pending}>Cancelar</button>
              <button
                className="btn btn-primary"
                disabled={pending || !renameValue.trim()}
                onClick={() => run(() => renameCampaignAction(renameFor.id, renameValue), () => setRenameFor(null))}
              >
                {pending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
