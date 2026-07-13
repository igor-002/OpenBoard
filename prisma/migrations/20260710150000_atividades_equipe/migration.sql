-- Módulo Atividades da Equipe:
--  - Task ganha workspaceId direto (permite tarefa sem projeto), origem, tipo,
--    cliente (FK real p/ IxcCliente.id), startedAt, estimatedMinutes, report.
--  - TaskType (categorias extensíveis, com seed idempotente).
--  - IxcCliente passa a aceitar cliente manual (ixcId null, manual=true).

CREATE TYPE "TaskOrigin" AS ENUM ('planejada', 'avulsa', 'presencial');

CREATE TABLE "TaskType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TaskType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskType_slug_key" ON "TaskType"("slug");

-- IxcCliente: permite cliente manual (fora do sync IXC)
ALTER TABLE "IxcCliente" ALTER COLUMN "ixcId" DROP NOT NULL;
ALTER TABLE "IxcCliente" ADD COLUMN "manual" BOOLEAN NOT NULL DEFAULT false;

-- Task: projeto vira opcional + novos campos (workspaceId nullable primeiro, p/ backfill)
ALTER TABLE "Task" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "Task" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Task" ADD COLUMN "origem" "TaskOrigin" NOT NULL DEFAULT 'planejada';
ALTER TABLE "Task" ADD COLUMN "tipoId" TEXT;
ALTER TABLE "Task" ADD COLUMN "ixcClienteId" TEXT;
ALTER TABLE "Task" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "estimatedMinutes" INTEGER;
ALTER TABLE "Task" ADD COLUMN "report" TEXT;

-- Backfill: herda workspace do projeto (toda task existente tem projeto)
UPDATE "Task" t SET "workspaceId" = p."workspaceId"
FROM "Project" p WHERE t."projectId" = p."id";
ALTER TABLE "Task" ALTER COLUMN "workspaceId" SET NOT NULL;

-- FKs + índices
ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_tipoId_fkey"
  FOREIGN KEY ("tipoId") REFERENCES "TaskType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_ixcClienteId_fkey"
  FOREIGN KEY ("ixcClienteId") REFERENCES "IxcCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Task_workspaceId_idx" ON "Task"("workspaceId");
CREATE INDEX "Task_tipoId_idx" ON "Task"("tipoId");
CREATE INDEX "Task_ixcClienteId_idx" ON "Task"("ixcClienteId");

-- Seed idempotente de TaskType (o prisma/seed.ts é destrutivo — NÃO usar)
INSERT INTO "TaskType" ("id", "name", "slug", "order") VALUES
  ('tt_suporte',      'Suporte',                     'suporte',                     0),
  ('tt_hotspot',      'Configuração de hotspot',     'configuracao-de-hotspot',     1),
  ('tt_visita',       'Visita técnica',              'visita-tecnica',              2),
  ('tt_instalacao',   'Instalação',                  'instalacao',                  3),
  ('tt_manutencao',   'Manutenção',                  'manutencao',                  4),
  ('tt_config_equip', 'Configuração de equipamento', 'configuracao-de-equipamento', 5),
  ('tt_reuniao',      'Reunião',                     'reuniao',                     6),
  ('tt_outro',        'Outro',                       'outro',                       7)
ON CONFLICT ("slug") DO NOTHING;
