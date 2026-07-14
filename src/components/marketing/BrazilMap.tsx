// Mapa do Brasil com pontos de acesso (SVG caseiro, zero dependência — padrão
// do repo). Ponto = cidade (centroide do IP), raio ∝ √cliques. Pontos fora do
// Brasil não são plotados — o chamador mostra a contagem à parte.
import { BRAZIL_STATE_PATHS, projectPoint, MAP_W, MAP_H } from "./BrazilMapData";

export type MapPoint = { lat: number; lon: number; label: string; count: number };

export function BrazilMap({ points, height = 300 }: { points: MapPoint[]; height?: number }) {
  const max = Math.max(...points.map((p) => p.count), 1);
  const radius = (count: number) => 3 + Math.sqrt(count / max) * 9;

  const plotted: { x: number; y: number; r: number; label: string; count: number }[] = [];
  for (const p of points) {
    const xy = projectPoint(p.lat, p.lon);
    if (xy) plotted.push({ x: xy[0], y: xy[1], r: radius(p.count), label: p.label, count: p.count });
  }

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      width="100%"
      height={height}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Mapa do Brasil com pontos de acesso"
    >
      {BRAZIL_STATE_PATHS.map((s) => (
        <path
          key={s.name}
          d={s.d}
          fill="color-mix(in srgb, var(--ink) 11%, var(--surface-3))"
          stroke="color-mix(in srgb, var(--ink) 26%, transparent)"
          strokeWidth="0.7"
        >
          <title>{s.name}</title>
        </path>
      ))}
      {plotted.map((p, i) => (
        <g key={i}>
          {/* Halo pulsante (SMIL — sem JS/CSS extra) */}
          <circle cx={p.x} cy={p.y} r={p.r} fill="var(--c1)" opacity="0.3">
            <animate
              attributeName="r"
              values={`${p.r * 0.55};${p.r * 1.25};${p.r * 0.55}`}
              dur="2.4s"
              begin={`${(i % 6) * 0.35}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.45;0.12;0.45"
              dur="2.4s"
              begin={`${(i % 6) * 0.35}s`}
              repeatCount="indefinite"
            />
          </circle>
          <circle
            cx={p.x}
            cy={p.y}
            r={Math.max(2.2, p.r * 0.45)}
            fill="var(--c1)"
            stroke="#fff"
            strokeWidth="0.8"
          >
            <title>{`${p.label} — ${p.count} clique(s)`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
