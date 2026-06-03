import { redirect } from "next/navigation";

// Raiz: o middleware já garante sessão; manda pro dashboard.
export default function Home() {
  redirect("/dashboard");
}
