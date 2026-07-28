-- AlterTable
ALTER TABLE "MktColumn" ADD COLUMN     "isDone" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MktCard" ADD COLUMN     "doneAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MktCard_doneAt_idx" ON "MktCard"("doneAt");

-- Colunas de saída do quadro que já existe (o board nasce no 1º acesso).
UPDATE "MktColumn" SET "isDone" = true
 WHERE "name" IN ('Concluído', 'Material Pronto') OR "glpiStatusId" IN (5, 6);

-- Card que já está numa coluna de saída começa com doneAt = agora, não com a data
-- real de conclusão (que não foi registrada). Assim nada some de surpresa: some
-- 2 dias depois desta migração.
UPDATE "MktCard" SET "doneAt" = NOW()
 WHERE "doneAt" IS NULL
   AND "columnId" IN (SELECT "id" FROM "MktColumn" WHERE "isDone" = true);
