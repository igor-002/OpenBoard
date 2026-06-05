import "./tv.css";

// Layout próprio do painel de TV: carrega o tv.css só nesta rota (classes .tv-*
// não vazam pro app) e não usa o AppShell.
export default function TvLayout({ children }: { children: React.ReactNode }) {
  return children;
}
