import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { firstToolHref, TOOL_KEYS } from "@/lib/modules";

// Entrada respeita a primeira ferramenta liberada. Ex.: só Contratos abre
// direto /comercial/contratos, sem passar pela Visão geral bloqueada.
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const tools = user.role === "admin" ? TOOL_KEYS : user.tools;
  redirect(firstToolHref(tools) ?? "/sem-acesso");
}
