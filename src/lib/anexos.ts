// Anexos de lead (propostas em PDF). Client-safe: usado na validação da UI e do
// server action. Bytes vão pro Postgres (ver model LeadAnexo no schema).

export const ANEXO_MAX_BYTES = 10 * 1024 * 1024; // 10MB por arquivo
export const ANEXO_MIME = "application/pdf";

export function anexoTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

// Nome de arquivo seguro: sem path (evita traversal), sem caracteres de controle,
// aspas ou barras (quebrariam o Content-Disposition), e sempre com extensão .pdf.
export function sanitizeNomeArquivo(nome: string): string {
  const semPath = nome.split(/[\\/]/).pop() ?? "";
  const limpo =
    Array.from(semPath)
      .filter((c) => c.charCodeAt(0) >= 32 && c !== '"' && c !== "\\")
      .join("")
      .trim()
      .slice(0, 120) || "proposta.pdf";
  return limpo.toLowerCase().endsWith(".pdf") ? limpo : `${limpo}.pdf`;
}

// Valida o que veio do input file antes de mandar pro server (a mesma checagem
// roda de novo no server action — o client só evita round-trip inútil).
export function validaAnexo(file: { name: string; type: string; size: number }): string | null {
  const ehPdf = file.type === ANEXO_MIME || file.name.toLowerCase().endsWith(".pdf");
  if (!ehPdf) return "Só é aceito arquivo PDF.";
  if (file.size === 0) return "Arquivo vazio.";
  if (file.size > ANEXO_MAX_BYTES) return `Arquivo muito grande (máx. ${anexoTamanho(ANEXO_MAX_BYTES)}).`;
  return null;
}
