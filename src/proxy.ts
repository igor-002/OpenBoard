import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/jwt";

const AUTH_PAGES = ["/login", "/register"];

// Convenção "proxy" do Next 16 (substitui o antigo middleware).
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  // Só protege rotas privadas. A página de login decide se manda pro dashboard
  // (checando o usuário real no banco) — evita loop com token órfão (usuário deletado).
  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
