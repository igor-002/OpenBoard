import { redirect } from "next/navigation";

// A tela Equipe saiu do menu: quem faz o quê está em Hoje, e a carga por pessoa
// no período está em Relatórios. A rota fica só pra não quebrar link antigo.
export default function TeamPage() {
  redirect("/reports");
}
