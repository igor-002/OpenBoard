import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { loginAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Se já há um usuário REAL logado, vai para sua primeira ferramenta. (Token órfão cai aqui e mostra o login.)
  const user = await getCurrentUser();
  if (user) redirect("/");
  return <AuthForm mode="login" action={loginAction} />;
}
