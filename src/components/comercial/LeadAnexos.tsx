"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { withBasePath } from "@/lib/basePath";
import { anexoTamanho, ANEXO_MAX_BYTES, validaAnexo } from "@/lib/anexos";
import { uploadLeadAnexo, deleteLeadAnexo } from "@/app/(comercial)/comercial/leads/actions";

export type AnexoView = { id: string; nome: string; tamanho: number; createdAt: string; uploadedByName: string | null };

export function LeadAnexos({ leadId, anexos }: { leadId: string; anexos: AnexoView[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(uploadLeadAnexo, {});
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [removendo, startRemover] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // upload ok → limpa o input e recarrega a lista
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setErroLocal(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const erro = validaAnexo(file);
    if (erro) {
      setErroLocal(erro);
      e.target.value = "";
      return;
    }
    formRef.current?.requestSubmit();
  }

  function remover(a: AnexoView) {
    if (!confirm(`Excluir "${a.nome}"? O arquivo é apagado do banco e não tem como recuperar.`)) return;
    startRemover(async () => {
      const r = await deleteLeadAnexo(a.id);
      if (r.error) setErroLocal(r.error);
      else router.refresh();
    });
  }

  const erro = erroLocal ?? state.error;

  return (
    <div style={{ padding: "4px 0" }}>
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="leadId" value={leadId} />
        <input
          ref={inputRef}
          type="file"
          name="arquivo"
          accept="application/pdf,.pdf"
          onChange={onPick}
          style={{ display: "none" }}
        />
      </form>

      <div className="row between" style={{ alignItems: "center", padding: "0 18px 12px", gap: 12, flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 12.5 }}>
          Só PDF · máx. {anexoTamanho(ANEXO_MAX_BYTES)} por arquivo
        </span>
        <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={pending}>
          <Icon name={pending ? "clock" : "plus"} size={15} className={pending ? "spin" : undefined} />{" "}
          {pending ? "Enviando…" : "Anexar proposta"}
        </button>
      </div>

      {erro && (
        <div className="form-error" style={{ margin: "0 18px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="alert" size={15} /> {erro}
        </div>
      )}

      {anexos.length === 0 ? (
        <div className="muted" style={{ padding: "0 18px 18px", fontSize: 13.5 }}>
          Nenhuma proposta anexada neste lead.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--line)" }}>
          {anexos.map((a) => (
            <div
              key={a.id}
              className="row between"
              style={{ alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--line)" }}
            >
              <a
                href={withBasePath(`/api/comercial/leads/${leadId}/anexos/${a.id}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="row gap8"
                style={{ alignItems: "center", minWidth: 0, textDecoration: "none", color: "inherit" }}
              >
                <Icon name="paperclip" size={16} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.nome}
                  </span>
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    {anexoTamanho(a.tamanho)} ·{" "}
                    {new Date(a.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {a.uploadedByName ? ` · ${a.uploadedByName}` : ""}
                  </span>
                </span>
              </a>
              <div className="row gap8" style={{ alignItems: "center", flexShrink: 0 }}>
                <a
                  className="btn btn-ghost"
                  href={withBasePath(`/api/comercial/leads/${leadId}/anexos/${a.id}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir / baixar"
                >
                  <Icon name="download" size={15} />
                </a>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => remover(a)}
                  disabled={removendo}
                  title="Excluir do banco"
                  style={{ color: "var(--st-risk)" }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
