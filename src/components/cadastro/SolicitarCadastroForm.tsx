"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { VENCIMENTO_DIAS, parseSolicitacaoTexto, type SolicitacaoPrefill } from "@/lib/cadastros";
import { solicitarCadastroAction, type SolicitarState } from "@/app/(public)/solicitar-cadastro/actions";

// Form público de solicitação de cadastro de cliente (sem login).
export function SolicitarCadastroForm() {
  const [state, formAction, pending] = useActionState<SolicitarState, FormData>(solicitarCadastroAction, {});
  // key do form: incrementa pra limpar os campos ao "Enviar outra solicitação".
  const [formKey, setFormKey] = useState(0);
  // "Enviar outra" não zera o state do useActionState — guarda a REFERÊNCIA do
  // state já dispensado; um novo envio cria outro objeto e mostra o sucesso de novo.
  const [dispensado, setDispensado] = useState<SolicitarState | null>(null);
  const enviado = !!state.ok && state !== dispensado;

  // "Colar preenchido": parseia o checklist de WhatsApp e vira defaultValue dos
  // campos (formKey remonta o form pra aplicar).
  const [prefill, setPrefill] = useState<SolicitacaoPrefill>({});
  const [textoColado, setTextoColado] = useState("");
  const [colarAberto, setColarAberto] = useState(false);
  const [preenchidos, setPreenchidos] = useState<number | null>(null);

  const aplicarTexto = () => {
    const p = parseSolicitacaoTexto(textoColado);
    const n = Object.keys(p).length;
    setPreenchidos(n);
    if (n > 0) {
      setPrefill(p);
      setFormKey((k) => k + 1);
      setColarAberto(false);
    }
  };

  if (enviado) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--st-done-bg)",
            color: "var(--st-done)",
            display: "inline-grid",
            placeItems: "center",
            marginBottom: 16,
          }}
        >
          <Icon name="checkCircle" size={30} />
        </span>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>Solicitação enviada!</h1>
        <p className="page-sub" style={{ marginBottom: 22 }}>
          O time comercial recebeu o pedido e vai processar o cadastro.
        </p>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => {
            setDispensado(state);
            setPrefill({});
            setTextoColado("");
            setPreenchidos(null);
            setFormKey((k) => k + 1);
          }}
        >
          <Icon name="plus" size={15} /> Enviar outra solicitação
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="auth-brand">
        <div className="sb-logo">
          <Icon name="layers" />
        </div>
        <div>
          <div className="sb-brand-name">OpenBoard</div>
          <div className="sb-brand-sub">Comercial</div>
        </div>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-.4px" }}>
        Solicitar cadastro de cliente
      </h1>
      <p className="page-sub" style={{ marginBottom: 16 }}>
        Preencha os dados do cliente. Campos com * são obrigatórios.
      </p>

      {/* Colar o checklist de WhatsApp já preenchido → completa os campos */}
      <div
        style={{
          border: "1px dashed var(--line-2)",
          borderRadius: "var(--r-md)",
          padding: colarAberto ? 14 : 0,
          marginBottom: 22,
          background: "var(--surface-2)",
        }}
      >
        {!colarAberto ? (
          <button
            type="button"
            className="btn"
            style={{ width: "100%", justifyContent: "center", border: "none", background: "transparent" }}
            onClick={() => setColarAberto(true)}
          >
            <Icon name="copy" size={15} /> Colar checklist preenchido (WhatsApp)
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea
              className="input"
              rows={8}
              value={textoColado}
              onChange={(e) => setTextoColado(e.target.value)}
              placeholder={"Cole aqui o texto:\n📄 Documentos necessários para fazermos o cadastro\n✅ Nome Completo/ Razão Social : ...\n✅ CPF/ CNPJ: ..."}
              style={{ resize: "vertical", fontSize: 13 }}
            />
            {preenchidos === 0 && (
              <div className="form-error">Não reconheci nenhum campo nesse texto. Confere se colou o checklist inteiro.</div>
            )}
            <div className="row gap8" style={{ flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary" onClick={aplicarTexto} disabled={!textoColado.trim()}>
                <Icon name="check" size={14} /> Preencher campos
              </button>
              <button type="button" className="btn" onClick={() => setColarAberto(false)}>
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
      {preenchidos !== null && preenchidos > 0 && (
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--st-done)", marginBottom: 14 }}
        >
          <Icon name="checkCircle" size={15} /> {preenchidos} campo{preenchidos > 1 ? "s" : ""} preenchido{preenchidos > 1 ? "s" : ""} — confira antes de enviar.
        </div>
      )}

      <form key={formKey} action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Honeypot anti-bot: invisível pra humanos, bots preenchem. */}
        <div style={{ position: "absolute", left: -9999, top: -9999 }} aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="field">
          <label htmlFor="solicitante">Seu nome (quem está solicitando) *</label>
          <input className="input" id="solicitante" name="solicitante" type="text" required maxLength={120} />
        </div>

        <div className="field">
          <label htmlFor="nomeCompleto">Nome completo / Razão Social *</label>
          <input className="input" id="nomeCompleto" name="nomeCompleto" type="text" required maxLength={200} defaultValue={prefill.nomeCompleto} />
        </div>

        <div className="row gap12" style={{ alignItems: "start", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="cnpjCpf">CPF / CNPJ *</label>
            <input className="input" id="cnpjCpf" name="cnpjCpf" type="text" required maxLength={30} inputMode="numeric" defaultValue={prefill.cnpjCpf} />
          </div>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="rg">RG</label>
            <input className="input" id="rg" name="rg" type="text" maxLength={30} defaultValue={prefill.rg} />
          </div>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="inscricaoEstadual">I.E. (Inscrição Estadual)</label>
            <input className="input" id="inscricaoEstadual" name="inscricaoEstadual" type="text" maxLength={30} defaultValue={prefill.inscricaoEstadual} />
          </div>
        </div>

        <div className="row gap12" style={{ alignItems: "start", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="cidade">Cidade</label>
            <input className="input" id="cidade" name="cidade" type="text" maxLength={120} defaultValue={prefill.cidade} />
          </div>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="bairro">Bairro</label>
            <input className="input" id="bairro" name="bairro" type="text" maxLength={120} defaultValue={prefill.bairro} />
          </div>
        </div>

        <div className="row gap12" style={{ alignItems: "start", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "2 1 200px" }}>
            <label htmlFor="rua">Rua</label>
            <input className="input" id="rua" name="rua" type="text" maxLength={160} defaultValue={prefill.rua} />
          </div>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="cep">CEP</label>
            <input className="input" id="cep" name="cep" type="text" maxLength={12} inputMode="numeric" defaultValue={prefill.cep} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="pontoReferencia">Ponto de referência 🏚️</label>
          <input className="input" id="pontoReferencia" name="pontoReferencia" type="text" maxLength={200} defaultValue={prefill.pontoReferencia} />
        </div>

        <div className="row gap12" style={{ alignItems: "start", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="telefone1">Telefone 1 *</label>
            <input className="input" id="telefone1" name="telefone1" type="tel" required maxLength={25} defaultValue={prefill.telefone1} />
          </div>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="telefone2">Telefone 2</label>
            <input className="input" id="telefone2" name="telefone2" type="tel" maxLength={25} defaultValue={prefill.telefone2} />
          </div>
        </div>

        <div className="row gap12" style={{ alignItems: "start", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "2 1 200px" }}>
            <label htmlFor="emailBoletos">E-mail para envio de boletos</label>
            <input className="input" id="emailBoletos" name="emailBoletos" type="email" maxLength={160} defaultValue={prefill.emailBoletos} />
          </div>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="vencimentoDia">Vencimento desejado</label>
            <select className="input" id="vencimentoDia" name="vencimentoDia" defaultValue={prefill.vencimentoDia ?? ""}>
              <option value="">—</option>
              {VENCIMENTO_DIAS.map((d) => (
                <option key={d} value={d}>
                  Dia {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row gap12" style={{ alignItems: "start", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "2 1 200px" }}>
            <label htmlFor="plano">Plano</label>
            <input className="input" id="plano" name="plano" type="text" maxLength={120} defaultValue={prefill.plano} />
          </div>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="valor">Valor (R$)</label>
            <input className="input" id="valor" name="valor" type="text" inputMode="decimal" placeholder="0,00" maxLength={20} defaultValue={prefill.valor} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="observacao">Observação</label>
          <textarea
            className="input"
            id="observacao"
            name="observacao"
            rows={3}
            maxLength={2000}
            placeholder="Ex.: Jogar na fila do MU"
            defaultValue={prefill.observacao}
            style={{ resize: "vertical" }}
          />
        </div>

        <div className="row gap12" style={{ alignItems: "start", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label>Situação</label>
            <div className="row" style={{ gap: 16, padding: "10px 2px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
                <input type="radio" name="situacao" value="normal" defaultChecked /> Normal
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
                <input type="radio" name="situacao" value="urgente" /> Urgente
              </label>
            </div>
          </div>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="prazoAt">Contrato precisa subir até (opcional)</label>
            <input className="input" id="prazoAt" name="prazoAt" type="date" />
          </div>
        </div>

        {state.error && <div className="form-error">{state.error}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Enviar solicitação"}
        </button>
      </form>
    </>
  );
}
