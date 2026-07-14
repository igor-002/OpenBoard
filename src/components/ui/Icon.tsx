// Ícones inline (estilo lucide, stroke 1.8). Portado 1:1 de icons.jsx.
import type { CSSProperties, ReactNode } from "react";

export type IconName =
  | "dot" | "grid" | "home" | "folder" | "kanban" | "timeline" | "clock"
  | "users" | "chart" | "inbox" | "settings" | "help" | "search" | "bell"
  | "plus" | "arrowUp" | "arrowDown" | "arrowUpRight" | "trendUp" | "chevDown"
  | "chevRight" | "chevLeft" | "more" | "filter" | "share" | "calendar"
  | "check" | "checkCircle" | "circle" | "dashCircle" | "flag" | "msg"
  | "paperclip" | "wallet" | "zap" | "target" | "layers" | "play" | "pause"
  | "download" | "star" | "sidebar" | "briefcase" | "alert" | "logout"
  | "link" | "qr" | "copy" | "edit" | "trash" | "externalLink";

const ICONS: Record<IconName, ReactNode> = {
  dot: <circle cx="12" cy="12" r="3" />,
  grid: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  home: (<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  kanban: (<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 7v6M16 7v9M12 7v3" /></>),
  timeline: (<><path d="M4 6h16M4 12h10M4 18h7" /><circle cx="20" cy="12" r="1.4" fill="currentColor" /><circle cx="13" cy="18" r="1.4" fill="currentColor" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  users: (<><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8M21 20a6 6 0 0 0-4-5.6" /></>),
  chart: (<><path d="M4 19V5" /><path d="M4 19h16" /><rect x="7" y="11" width="3" height="5" rx="1" fill="currentColor" stroke="none" /><rect x="12.5" y="8" width="3" height="8" rx="1" fill="currentColor" stroke="none" /><rect x="18" y="13" width="3" height="3" rx="1" fill="currentColor" stroke="none" /></>),
  inbox: (<><path d="M3 12h5l2 3h4l2-3h5" /><path d="M5 5h14l2 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 6.8 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1-2.7H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 5 6.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H10a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V10a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>),
  help: (<><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .8-1 1.7" /><circle cx="12" cy="16.5" r=".6" fill="currentColor" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>),
  bell: (<><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10.5 20a2 2 0 0 0 3 0" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  arrowUpRight: <path d="M7 17 17 7M9 7h8v8" />,
  trendUp: (<><path d="M3 17 9 11l4 4 8-8" /><path d="M21 7v5h-5" /></>),
  chevDown: <path d="m6 9 6 6 6-6" />,
  chevRight: <path d="m9 6 6 6-6 6" />,
  chevLeft: <path d="m15 6-6 6 6 6" />,
  more: (<><circle cx="12" cy="5" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="19" r="1.4" fill="currentColor" /></>),
  filter: <path d="M3 5h18l-7 8v5l-4 2v-7z" />,
  share: (<><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" /></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>),
  check: <path d="m5 12 4.5 4.5L19 6" />,
  checkCircle: (<><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.3 2.3L15.5 9.5" /></>),
  circle: <circle cx="12" cy="12" r="8.5" />,
  dashCircle: <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />,
  flag: <path d="M5 21V4M5 4h12l-2 3 2 3H5" />,
  msg: <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />,
  paperclip: <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3" />,
  wallet: (<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 14h2" /></>),
  zap: <path d="M13 3 4 14h6l-1 7 9-11h-6z" />,
  target: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /></>),
  layers: (<><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5M3 18l9 5 9-5" opacity=".5" /></>),
  play: <path d="M7 5v14l11-7z" fill="currentColor" stroke="none" />,
  pause: (<><rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" /></>),
  download: (<><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>),
  star: <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z" />,
  sidebar: (<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>),
  briefcase: (<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>),
  alert: (<><path d="M12 3 2 20h20z" /><path d="M12 9v5M12 17h.01" /></>),
  logout: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>),
  link: (<><path d="M10 13a5 5 0 0 0 7.1.5l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.1-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7" /></>),
  qr: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3h-3z" /></>),
  copy: (<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>),
  edit: (<><path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></>),
  trash: (<><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></>),
  externalLink: (<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6M10 14 21 3" /></>),
};

export function Icon({
  name,
  size = 20,
  style,
  className,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name] ?? ICONS.dot}
    </svg>
  );
}
