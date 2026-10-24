// Página pública /arquivo-txt: alguém sobe um .txt e um script no PC de destino
// (scripts/arquivo-txt-sync.ps1) baixa e grava por cima do arquivo local.
// As rotas ficam liberadas no proxy; a proteção é a chave ARQUIVO_TXT_TOKEN,
// usada tanto no link da página quanto pelo script.
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { checkRateLimit, registerFailure } from "@/lib/rate-limit";
import { clientIp } from "@/lib/short/ip";

export const ARQUIVO_TXT_MAX_BYTES = 10 * 1024 * 1024;
export const ARQUIVO_TXT_VERSOES_GUARDADAS = 20;

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export type ChaveResultado = { ok: true } | { ok: false; status: 401 | 429 | 500; error: string };

// Valida ?key= contra o env. Falha-fechado sem token configurado; 5 erros por IP
// em 15 min bloqueiam (mesmo rate-limit do login).
export function validaChaveArquivoTxt(req: Request): ChaveResultado {
  const esperado = process.env.ARQUIVO_TXT_TOKEN;
  if (!esperado || esperado.length < 16) return { ok: false, status: 500, error: "nao_configurado" };
  const rlKey = `arquivo-txt:${clientIp(req) ?? "?"}`;
  if (!checkRateLimit(rlKey).ok) return { ok: false, status: 429, error: "muitas_tentativas" };
  const fornecido = new URL(req.url).searchParams.get("key");
  if (!fornecido || !safeEqual(fornecido, esperado)) {
    registerFailure(rlKey);
    return { ok: false, status: 401, error: "chave_invalida" };
  }
  return { ok: true };
}

// Conta linhas como o editor mostra: última linha sem \n também conta.
export function contaLinhas(buf: Uint8Array): number {
  if (buf.length === 0) return 0;
  let n = 0;
  for (const b of buf) if (b === 0x0a) n++;
  return buf[buf.length - 1] === 0x0a ? n : n + 1;
}

// Arquivo binário (imagem, planilha renomeada pra .txt) tem byte nulo; texto não.
export function pareceTexto(buf: Uint8Array): boolean {
  return !buf.includes(0);
}

// Primeiras linhas pra conferência na página (sem BOM).
export function previa(buf: Uint8Array, max = 5): string[] {
  const texto = new TextDecoder("utf-8").decode(buf.subarray(0, 4096)).replace(/^﻿/, "");
  return texto.split(/\r?\n/).slice(0, max).filter((l) => l.length > 0);
}
