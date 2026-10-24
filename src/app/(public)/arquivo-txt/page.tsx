import type { Metadata } from "next";
import { ArquivoTxtUpload } from "@/components/arquivo-txt/ArquivoTxtUpload";

export const metadata: Metadata = { title: "Atualizar arquivo 009.txt — OpenBoard", robots: { index: false } };

// Página PÚBLICA (liberada no proxy.ts) com gate pela chave ?key=ARQUIVO_TXT_TOKEN,
// validada nas rotas /api/arquivo-txt. Sem chave a página nem mostra o formulário.
export default async function ArquivoTxtPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  return (
    <div className="auth-wrap" style={{ alignItems: "start", paddingTop: 40, paddingBottom: 40 }}>
      <div className="auth-card" style={{ maxWidth: 560, minWidth: 0 }}>
        <ArquivoTxtUpload chave={key ?? ""} />
      </div>
    </div>
  );
}
