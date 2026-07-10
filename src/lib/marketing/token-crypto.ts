// Criptografia do token de acesso do Instagram em repouso (AES-256-GCM).
// Chave: env TOKEN_ENC_KEY (base64 de 32 bytes → `openssl rand -base64 32`).
// Sem a chave, a app sobe mas conectar/renovar token falha com erro claro.
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:"; // marca formato criptografado (distingue de token legado em texto puro)

function key(): Buffer {
  const raw = process.env.TOKEN_ENC_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_ENC_KEY ausente. Gere com `openssl rand -base64 32` e defina no ambiente " +
        "para criptografar os tokens do Instagram.",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENC_KEY inválida: precisa ser 32 bytes em base64.");
  }
  return buf;
}

// Cifra: enc:v1:<iv b64>:<authTag b64>:<ciphertext b64>
export function encryptToken(plain: string): string {
  const iv = randomBytes(12); // GCM: nonce de 12 bytes
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

// Descriptografa. Tokens antigos (sem prefixo) são retornados como estão — permite
// migração suave: rows legadas seguem funcionando até o próximo reconnect/refresh.
export function decryptToken(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // legado em texto puro
  const [, ivB64, tagB64, ctB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
