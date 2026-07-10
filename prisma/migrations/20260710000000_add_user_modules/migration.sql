-- AlterTable
-- Controle de acesso por módulo por usuário (segurança: impede membro comum de
-- ver/editar Comercial, Leads, Margem, Marketing sem permissão). Admin ignora.
-- IF NOT EXISTS para ser idempotente caso a coluna já tenha sido aplicada à mão.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill de rollout: usuários que JÁ existem tinham acesso a tudo (não havia RBAC).
-- Concede todos os módulos aos usuários atuais para não travar ninguém no deploy;
-- o admin depois restringe cada um em Configurações → Usuários. Novos usuários
-- começam com [] (sem acesso a módulos gated). Só afeta linhas com modules vazio.
UPDATE "User"
SET "modules" = ARRAY['gestao','comercial','leads','margem','marketing']
WHERE "modules" = ARRAY[]::TEXT[];
