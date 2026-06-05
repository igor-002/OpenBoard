import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/jwt";

const AUTH_PAGES = ["/login", "/register"];
// Rotas públicas com gate próprio por token (painel de TV). Não exigem sessão.
const PUBLIC_PAGES = ["/tv", "/api/tv"];

// Convenção "proxy" do Next 16 (substitui o antigo middleware).
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));
  const isPublic = PUBLIC_PAGES.some((p) => pathname.startsWith(p));

  // Só protege rotas privadas. A página de login decide se manda pro dashboard
  // (checando o usuário real no banco) — evita loop com token órfão (usuário deletado).
  if (!session && !isAuthPage && !isPublic) {
    // clone() preserva o basePath (ex.: /openboard) no redirect.
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
