import Link from "next/link";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Mostrada quando o usuário logado tenta abrir um módulo sem permissão.
export default async function SemAcessoPage() {
  await requireUser(); // exige sessão; não exige módulo nenhum
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Sem acesso a este módulo</h1>
        <p style={{ color: "#64748b", marginBottom: 20 }}>
          Você não tem permissão para esta área. Fale com um administrador para liberar o acesso.
        </p>
        <Link href="/dashboard" style={{ color: "#2D6FF2", fontWeight: 600 }}>
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
