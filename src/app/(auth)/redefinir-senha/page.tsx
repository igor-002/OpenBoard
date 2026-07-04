import { ResetPasswordForm } from "@/components/auth/PasswordResetForms";

export const dynamic = "force-dynamic";

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={token ?? ""} />;
}
