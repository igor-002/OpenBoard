"use client";

import { useState, useTransition } from "react";
import {
  createLinkAction,
  updateLinkAction,
  type LinkInput,
} from "@/app/(marketing)/marketing/links/actions";
import type { LinkRow, CampaignOption } from "./LinksManager";

// Criação/edição de link curto. Tipo WhatsApp monta o destino wa.me com a
// mensagem pronta — o usuário só preenche número e texto. Na edição o slug é
// travado (é ele que está impresso no QR).
export function LinkFormModal({
  shortBase,
  campaigns,
  link,
  onClose,
  onSaved,
}: {
  shortBase: string;
  campaigns: CampaignOption[];
  link: LinkRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = link !== null;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<"url" | "whatsapp">(link?.kind === "whatsapp" ? "whatsapp" : "url");
  const [title, setTitle] = useState(link?.title ?? "");
  const [destination, setDestination] = useState(link && link.kind === "url" ? link.destination : "");
  const [waPhone, setWaPhone] = useState(link?.waPhone ?? "");
  const [waMessage, setWaMessage] = useState(link?.waMessage ?? "");
  const [customSlug, setCustomSlug] = useState("");
  const [campaignId, setCampaignId] = useState(link?.campaignId ?? "");
  const [tags, setTags] = useState(link?.tags ?? "");
  const [expiresAt, setExpiresAt] = useState(link?.expiresAt ? link.expiresAt.slice(0, 10) : "");

  const canSave =
    kind === "whatsapp" ? waPhone.trim().length > 0 : destination.trim().length > 0;

  function save() {
    const input: LinkInput = {
      title,
      kind,
      destination,
      waPhone,
      waMessage,
      customSlug,
      campaignId,
      tags,
      expiresAt,
    };
    setError(null);
    start(async () => {
      const r = editing ? await updateLinkAction(link.id, input) : await createLinkAction(input);
      if (r.ok) onSaved();
      else setError(r.error ?? "Erro inesperado.");
    });
  }

  const label = { fontSize: 12.5, fontWeight: 700, marginBottom: 4, display: "block" } as const;
  const field = { marginBottom: 12 } as const;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        className="card card-pad"
        style={{ width: 520, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="card-title" style={{ marginBottom: 4 }}>
          {editing ? "Editar link" : "Novo link curto"}
        </h3>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
          {editing
            ? "O destino pode ser trocado à vontade — a URL curta e o QR já impresso continuam valendo."
            : "O QR Code sempre aponta pra URL curta, nunca pro destino final."}
        </p>

        <div className="row gap8" style={{ marginBottom: 14 }}>
          <button
            className={`btn ${kind === "url" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setKind("url")}
            disabled={editing && link.kind === "whatsapp"}
          >
            URL comum
          </button>
          <button
            className={`btn ${kind === "whatsapp" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setKind("whatsapp")}
            disabled={editing && link.kind === "url"}
          >
            WhatsApp com mensagem
          </button>
        </div>

        <div style={field}>
          <label style={label}>Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Ex.: "Panfleto julho — fibra 500MB"'
            className="input"
            style={{ width: "100%" }}
          />
        </div>

        {kind === "url" ? (
          <div style={field}>
            <label style={label}>Destino (URL completa)</label>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="https://…"
              className="input"
              style={{ width: "100%" }}
            />
          </div>
        ) : (
          <>
            <div style={field}>
              <label style={label}>Número do WhatsApp (DDI + DDD + número)</label>
              <input
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value)}
                placeholder="5511999998888"
                className="input"
                style={{ width: "100%" }}
              />
            </div>
            <div style={field}>
              <label style={label}>Mensagem pronta (o cliente já chega com ela digitada)</label>
              <textarea
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                placeholder="Olá! Vi o panfleto e quero saber mais sobre os planos."
                rows={3}
                className="input"
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
          </>
        )}

        {!editing && (
          <div style={field}>
            <label style={label}>Slug personalizado (opcional)</label>
            <div className="row gap8" style={{ alignItems: "center" }}>
              <span className="muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{shortBase}/r/</span>
              <input
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                placeholder="aleatório se vazio"
                className="input"
                style={{ flex: 1 }}
              />
            </div>
          </div>
        )}

        <div className="row gap12" style={{ flexWrap: "wrap" }}>
          <div style={{ ...field, flex: 1, minWidth: 180 }}>
            <label style={label}>Campanha</label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="input"
              style={{ width: "100%" }}
            >
              <option value="">Sem campanha</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ ...field, flex: 1, minWidth: 160 }}>
            <label style={label}>Expira em (opcional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="input"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div style={field}>
          <label style={label}>Tags (separadas por vírgula)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="panfleto, zona-sul"
            className="input"
            style={{ width: "100%" }}
          />
        </div>

        {error && (
          <p style={{ color: "var(--st-risk)", fontSize: 12.5, marginBottom: 10 }}>{error}</p>
        )}

        <div className="row gap8" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={pending}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={pending || !canSave}>
            {pending ? "Salvando…" : editing ? "Salvar" : "Criar link"}
          </button>
        </div>
      </div>
    </div>
  );
}
