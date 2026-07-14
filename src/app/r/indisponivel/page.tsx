// Página pública de "link indisponível" (desativado/expirado/inexistente).
// Sem sessão e sem AppShell — quem chega aqui veio de um QR impresso.

export const metadata = { title: "Link indisponível" };

export default function LinkIndisponivelPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔗</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Link indisponível</h1>
        <p style={{ color: "var(--muted, #667085)", fontSize: 14.5, lineHeight: 1.55 }}>
          Este link foi desativado ou expirou. Se você chegou aqui por um QR Code,
          procure o material mais recente ou entre em contato com quem o divulgou.
        </p>
      </div>
    </div>
  );
}
