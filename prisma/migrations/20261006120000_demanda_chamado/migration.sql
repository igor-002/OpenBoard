-- Demanda vira chamado: número, solicitante, descrição, criador, status
-- "aguardando" e "cancelada", canais novos e histórico de eventos.

-- Status: "review" não tinha sentido em atendimento; vira "waiting".
ALTER TYPE "TaskColumn" RENAME VALUE 'review' TO 'waiting';
ALTER TYPE "TaskColumn" ADD VALUE 'canceled';

ALTER TYPE "TaskOrigin" ADD VALUE 'whatsapp';
ALTER TYPE "TaskOrigin" ADD VALUE 'telefone';
ALTER TYPE "TaskOrigin" ADD VALUE 'monitoramento';

ALTER TABLE "Task"
  ADD COLUMN "numero" INTEGER,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "solicitante" TEXT,
  ADD COLUMN "creatorId" TEXT,
  ADD COLUMN "waitingReason" TEXT,
  ADD COLUMN "canceledAt" TIMESTAMP(3);

-- Numera o que já existe pela ordem de criação, depois liga a sequência.
UPDATE "Task" t SET "numero" = n.rn
FROM (SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS rn FROM "Task") n
WHERE n."id" = t."id";

CREATE SEQUENCE "Task_numero_seq" AS INTEGER OWNED BY "Task"."numero";
SELECT setval('"Task_numero_seq"', COALESCE((SELECT MAX("numero") FROM "Task"), 0) + 1, false);
ALTER TABLE "Task" ALTER COLUMN "numero" SET DEFAULT nextval('"Task_numero_seq"');
ALTER TABLE "Task" ALTER COLUMN "numero" SET NOT NULL;

CREATE UNIQUE INDEX "Task_numero_key" ON "Task"("numero");
CREATE INDEX "Task_creatorId_idx" ON "Task"("creatorId");

ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskEvent_taskId_createdAt_idx" ON "TaskEvent"("taskId", "createdAt");
CREATE INDEX "TaskEvent_actorId_idx" ON "TaskEvent"("actorId");

ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
