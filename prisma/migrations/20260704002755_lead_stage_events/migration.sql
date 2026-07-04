-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "LeadStageEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "movedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadStageEvent_leadId_createdAt_idx" ON "LeadStageEvent"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadStageEvent_toStage_createdAt_idx" ON "LeadStageEvent"("toStage", "createdAt");

-- Backfill: leads existentes não têm histórico. Aproximação:
--   stage = 'novo'  → entrou no estágio quando foi criado (exato)
--   stage != 'novo' → melhor estimativa é o último update do registro
UPDATE "Lead" SET "stageChangedAt" = CASE WHEN "stage" = 'novo' THEN "createdAt" ELSE "updatedAt" END;

-- Evento de entrada no funil p/ todo lead existente (fromStage null → novo)
INSERT INTO "LeadStageEvent" ("id", "leadId", "fromStage", "toStage", "createdAt")
SELECT gen_random_uuid()::text, "id", NULL, 'novo', "createdAt" FROM "Lead";

-- Leads já fora de 'novo': registra a transição aproximada novo → estágio atual
INSERT INTO "LeadStageEvent" ("id", "leadId", "fromStage", "toStage", "createdAt")
SELECT gen_random_uuid()::text, "id", 'novo', "stage", "stageChangedAt" FROM "Lead" WHERE "stage" <> 'novo';
