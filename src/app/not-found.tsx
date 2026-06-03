import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 56, fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--primary)", letterSpacing: "-2px" }}>404</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "8px 0 6px" }}>Página não encontrada</h1>
        <p className="page-sub" style={{ marginBottom: 22 }}>O endereço não existe ou foi movido.</p>
        <Link href="/dashboard" className="btn btn-primary btn-block" style={{ display: "inline-flex" }}>
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
