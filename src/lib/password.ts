// Hash e verificação de senha (bcrypt).
import bcrypt from "bcryptjs";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Hash "isca" (cost 10) para o login rodar bcrypt mesmo quando o e-mail não existe.
// Sem isso, a diferença de tempo (bcrypt só roda p/ usuário real) permite enumerar
// e-mails válidos. Nunca bate com nenhuma senha — é só p/ igualar o tempo de resposta.
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("openboard-dummy-password", 10);
