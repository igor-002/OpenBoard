-- Demanda do Principal pode abrir chamado no GLPI do Marketing, conforme regras
-- configuradas em /settings/glpi. Só acrescenta: duas colunas e uma tabela.

ALTER TABLE "Task"
  ADD COLUMN "glpiId" INTEGER,
  ADD COLUMN "glpiFechaJunto" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Task_glpiId_idx" ON "Task"("glpiId");

CREATE TABLE "GlpiRegra" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "tipoId" TEXT,
  "assigneeId" TEXT,
  "glpiAssigneeId" INTEGER,
  "glpiRequesterId" INTEGER,
  "glpiCategoryId" INTEGER,
  "glpiType" INTEGER NOT NULL DEFAULT 2,
  "fecharJunto" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GlpiRegra_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GlpiRegra_workspaceId_active_idx" ON "GlpiRegra"("workspaceId", "active");
