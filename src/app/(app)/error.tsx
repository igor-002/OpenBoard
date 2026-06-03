"use client";

import Link from "next/link";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
      <div className="card card-pad" style={{ textAlign: "center", maxWidth: 420, padding: 32 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--st-risk-bg)", color: "var(--st-risk)", display: "grid", placeItems: "center", margin: "0 auto 16px", fontSize: 26, fontWeight: 800 }}>
          !
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 6px" }}>Algo deu errado</h1>
        <p className="page-sub" style={{ marginBottom: 22 }}>Tente novamente. Se persistir, recarregue a página.</p>
        <div className="row gap12" style={{ justifyContent: "center" }}>
          <button className="btn" onClick={reset}>Tentar de novo</button>
          <Link href="/dashboard" className="btn btn-primary">Ir para o início</Link>
        </div>
      </div>
    </div>
  );
}
