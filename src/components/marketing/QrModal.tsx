"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { Icon } from "@/components/ui/Icon";
import { saveQrOptionsAction } from "@/app/(marketing)/marketing/links/actions";
import type { LinkRow } from "./LinksManager";

// QR Code do link curto (client-side, lib `qrcode`): preview reativo com cor,
// fundo e logo central. O QR codifica SEMPRE a URL curta — trocar o destino
// não invalida o impresso. Com logo, correção de erro sobe pra "H".
const PNG_SIZE = 1024;
const LOGO_RATIO = 0.24; // lado da logo relativo ao QR (seguro com nível H)

function injectLogo(svg: string, logo: string, bg: string): string {
  const m = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  if (!m) return svg;
  const n = parseFloat(m[1]);
  const side = n * LOGO_RATIO;
  const pad = n * 0.02;
  const x = (n - side) / 2;
  const badge =
    `<rect x="${x - pad}" y="${x - pad}" width="${side + 2 * pad}" height="${side + 2 * pad}" fill="${bg}" rx="${pad * 2}"/>` +
    `<image href="${logo}" x="${x}" y="${x}" width="${side}" height="${side}" preserveAspectRatio="xMidYMid meet"/>`;
  return svg.replace("</svg>", `${badge}</svg>`);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function QrModal({ link, onClose }: { link: LinkRow; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [color, setColor] = useState(link.qrColor);
  const [bg, setBg] = useState(link.qrBgColor);
  const [logo, setLogo] = useState<string | null>(link.qrLogo);
  const [svg, setSvg] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toString(link.shortUrl, {
      type: "svg",
      errorCorrectionLevel: logo ? "H" : "M",
      color: { dark: color, light: bg },
      margin: 2,
    })
      .then((s) => {
        if (alive) setSvg(logo ? injectLogo(s, logo, bg) : s);
      })
      .catch(() => {
        if (alive) setMsg("Falha ao gerar o QR.");
      });
    return () => {
      alive = false;
    };
  }, [link.shortUrl, color, bg, logo]);

  function onLogoFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setMsg("Arquivo de logo precisa ser uma imagem.");
      return;
    }
    // Reduz pra 128px e re-encoda em PNG: data URI sempre pequena (cabe no banco)
    // e o rasterizador do canvas não engasga com formatos exóticos.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext("2d")!;
      const scale = Math.min(128 / img.width, 128 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);
      setLogo(c.toDataURL("image/png"));
      setMsg(null);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setMsg("Não foi possível ler a imagem.");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function downloadSvg() {
    download(new Blob([svg], { type: "image/svg+xml" }), `qr-${link.slug}.svg`);
  }

  function downloadPng() {
    // Rasteriza o MESMO SVG do preview (alta resolução pra impressão).
    const sized = svg.replace("<svg ", `<svg width="${PNG_SIZE}" height="${PNG_SIZE}" `);
    const svgUrl = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = PNG_SIZE;
      c.height = PNG_SIZE;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, PNG_SIZE, PNG_SIZE);
      ctx.drawImage(img, 0, 0, PNG_SIZE, PNG_SIZE);
      c.toBlob((blob) => {
        if (blob) download(blob, `qr-${link.slug}.png`);
        URL.revokeObjectURL(svgUrl);
      }, "image/png");
    };
    img.onerror = () => {
      setMsg("Falha ao rasterizar o PNG — baixe o SVG.");
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  }

  function saveDefaults() {
    setMsg(null);
    start(async () => {
      const r = await saveQrOptionsAction(link.id, { qrColor: color, qrBgColor: bg, qrLogo: logo });
      setMsg(r.ok ? "Customização salva." : (r.error ?? "Erro ao salvar."));
    });
  }

  const label = { fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 4 } as const;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        className="card card-pad"
        style={{ width: 560, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="card-title" style={{ marginBottom: 4 }}>QR Code — {link.title || link.slug}</h3>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 14, wordBreak: "break-all" }}>
          Codifica <b>{link.shortUrl}</b> — o destino pode mudar depois, o QR impresso continua valendo.
        </p>

        <div className="row gap12" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
          <div
            style={{ width: 220, height: 220, flexShrink: 0, border: "1px solid var(--line-2)", borderRadius: 8, overflow: "hidden", background: bg }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="row gap12" style={{ marginBottom: 12 }}>
              <div>
                <label style={label}>Cor do QR</label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 60, height: 32, padding: 0, border: "1px solid var(--line-2)", borderRadius: 6, cursor: "pointer" }} />
              </div>
              <div>
                <label style={label}>Fundo</label>
                <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} style={{ width: 60, height: 32, padding: 0, border: "1px solid var(--line-2)", borderRadius: 6, cursor: "pointer" }} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Logo no centro (opcional)</label>
              <div className="row gap8" style={{ alignItems: "center" }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && onLogoFile(e.target.files[0])}
                  style={{ fontSize: 12 }}
                />
                {logo && (
                  <button className="btn btn-ghost" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => setLogo(null)}>
                    Remover
                  </button>
                )}
              </div>
              <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                Com logo, o QR usa correção de erro nível H automaticamente.
              </p>
            </div>
            <div className="row gap8" style={{ flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={downloadPng} disabled={!svg}>
                <Icon name="download" size={15} /> PNG
              </button>
              <button className="btn btn-primary" onClick={downloadSvg} disabled={!svg}>
                <Icon name="download" size={15} /> SVG
              </button>
              <button className="btn btn-ghost" onClick={saveDefaults} disabled={pending}>
                {pending ? "Salvando…" : "Salvar customização"}
              </button>
            </div>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              SVG é o ideal pra gráfica/impressão em alta qualidade.
            </p>
          </div>
        </div>

        {msg && <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>{msg}</p>}

        <div className="row gap8" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
