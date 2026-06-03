import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AuthForm } from "@/components/auth/AuthForm";
import { registerAction } from "../actions";

// Depende do banco em runtime (checa se já existe usuário) — não prerenderizar.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  // Cadastro só é permitido para criar o primeiro usuário (admin).
  const count = await db.user.count();
  if (count > 0) redirect("/login");
  return <AuthForm mode="register" action={registerAction} />;
}
