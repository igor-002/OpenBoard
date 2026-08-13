-- Expand project persistence without removing existing client/category text.
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Project" ALTER COLUMN "startDate" DROP NOT NULL;
ALTER TABLE "Project" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Project" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Project" ADD COLUMN "source" TEXT;
ALTER TABLE "Project" ADD COLUMN "externalDealId" TEXT;

CREATE TABLE "ProjectClient" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "emailNorm" TEXT,
    "phone" TEXT,
    "document" TEXT,
    "documentNorm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectCategory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "notificationsCreated" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- Existing tags become API categories. IDs are deterministic only for this
-- backfill; Prisma creates CUIDs for all future records.
INSERT INTO "ProjectCategory" ("id", "workspaceId", "name", "key", "updatedAt")
SELECT
  'legacy-category-' || md5("workspaceId" || ':' || lower(btrim("tag"))),
  "workspaceId",
  min(btrim("tag")),
  lower(btrim("tag")),
  CURRENT_TIMESTAMP
FROM "Project"
WHERE btrim("tag") <> ''
GROUP BY "workspaceId", lower(btrim("tag"));

UPDATE "Project" AS p
SET "categoryId" = c."id"
FROM "ProjectCategory" AS c
WHERE c."workspaceId" = p."workspaceId"
  AND c."key" = lower(btrim(p."tag"));

CREATE UNIQUE INDEX "ProjectClient_workspaceId_externalId_key" ON "ProjectClient"("workspaceId", "externalId");
CREATE UNIQUE INDEX "ProjectClient_workspaceId_emailNorm_key" ON "ProjectClient"("workspaceId", "emailNorm");
CREATE UNIQUE INDEX "ProjectClient_workspaceId_documentNorm_key" ON "ProjectClient"("workspaceId", "documentNorm");
CREATE INDEX "ProjectClient_workspaceId_idx" ON "ProjectClient"("workspaceId");
CREATE UNIQUE INDEX "ProjectCategory_workspaceId_key_key" ON "ProjectCategory"("workspaceId", "key");
CREATE INDEX "ProjectCategory_workspaceId_active_idx" ON "ProjectCategory"("workspaceId", "active");
CREATE UNIQUE INDEX "IntegrationEvent_source_eventId_key" ON "IntegrationEvent"("source", "eventId");
CREATE UNIQUE INDEX "IntegrationEvent_source_idempotencyKey_key" ON "IntegrationEvent"("source", "idempotencyKey");
CREATE INDEX "IntegrationEvent_workspaceId_idx" ON "IntegrationEvent"("workspaceId");
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");
CREATE INDEX "Project_categoryId_idx" ON "Project"("categoryId");
CREATE UNIQUE INDEX "Project_source_externalDealId_key" ON "Project"("source", "externalDealId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ProjectClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProjectCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectClient" ADD CONSTRAINT "ProjectClient_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectCategory" ADD CONSTRAINT "ProjectCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ProjectClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
