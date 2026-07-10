import { requireModule } from "@/lib/permissions";

// Leads contêm PII (CPF/CNPJ, telefone, e-mail, transcrição de conversa). Além do
// módulo "comercial" (layout pai), exige o módulo "leads". Admin sempre entra.
export default async function LeadsLayout({ children }: { children: React.ReactNode }) {
  await requireModule("leads");
  return <>{children}</>;
}
