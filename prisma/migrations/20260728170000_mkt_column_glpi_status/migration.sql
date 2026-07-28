-- AlterTable
ALTER TABLE "MktColumn" ADD COLUMN     "glpiStatusId" INTEGER;

-- Mapeia as colunas padrão do quadro já existente (o board é criado no 1º acesso,
-- então em prod as colunas já estão lá sem mapeamento nenhum).
UPDATE "MktColumn" SET "glpiStatusId" = 1 WHERE "name" = 'Novos'               AND "glpiStatusId" IS NULL;
UPDATE "MktColumn" SET "glpiStatusId" = 4 WHERE "name" = 'Pendente'            AND "glpiStatusId" IS NULL;
UPDATE "MktColumn" SET "glpiStatusId" = 2 WHERE "name" = 'Atribuídos ao Setor' AND "glpiStatusId" IS NULL;
UPDATE "MktColumn" SET "glpiStatusId" = 5 WHERE "name" = 'Concluído'           AND "glpiStatusId" IS NULL;
UPDATE "MktColumn" SET "glpiStatusId" = 6 WHERE "name" = 'Material Pronto'     AND "glpiStatusId" IS NULL;
