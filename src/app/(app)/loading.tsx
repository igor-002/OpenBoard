export default function Loading() {
  return (
    <div className="page" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            margin: "0 auto 14px",
            background: "linear-gradient(140deg, var(--primary), var(--primary-700))",
            animation: "ob-pulse 1s ease-in-out infinite",
          }}
        />
        <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Carregando…</div>
      </div>
    </div>
  );
}
