import type { Metadata } from "next";
import { SolicitarCadastroForm } from "@/components/cadastro/SolicitarCadastroForm";

export const metadata: Metadata = { title: "Solicitar cadastro de cliente — OpenBoard" };

// Página PÚBLICA (liberada no proxy.ts): qualquer pessoa com o link envia uma
// solicitação de cadastro pro comercial. Anti-spam na action (rate-limit + honeypot).
export default function SolicitarCadastroPage() {
  return (
    <div className="auth-wrap" style={{ alignItems: "start", paddingTop: 40, paddingBottom: 40 }}>
      {/* minWidth 0: item de grid não encolhe abaixo do min-content por padrão
          (botão largo estourava a viewport no celular → scroll horizontal) */}
      <div className="auth-card" style={{ maxWidth: 680, minWidth: 0 }}>
        <SolicitarCadastroForm />
      </div>
    </div>
  );
}
