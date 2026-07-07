-- AlterTable
-- IF NOT EXISTS: "motivoPerda" já foi aplicada em produção fora do fluxo de
-- migrations (commit 15be38d, gestao/churn) — sem isso a migration inteira
-- falha por colisão de coluna (P3018) antes de chegar nas tabelas novas.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "motivoPerda" TEXT;

-- CreateTable
-- Mesmo motivo: ContratoStatusEvent pode já existir em produção.
CREATE TABLE IF NOT EXISTS "ContratoStatusEvent" (
    "id" TEXT NOT NULL,
    "contratoIxcId" TEXT NOT NULL,
    "clienteIxcId" TEXT NOT NULL,
    "vendedorIxcId" TEXT,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "mrrCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratoStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "MarketingCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "igUserId" TEXT,
    "accessToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "InstagramAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountMetricsHistory" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountMetricsHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaTypeStats" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "period" TEXT NOT NULL,

    CONSTRAINT "MediaTypeStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "avatarColor" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingTask" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "priority" TEXT NOT NULL DEFAULT 'media',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MarketingTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContratoStatusEvent_contratoIxcId_idx" ON "ContratoStatusEvent"("contratoIxcId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContratoStatusEvent_toStatus_createdAt_idx" ON "ContratoStatusEvent"("toStatus", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContratoStatusEvent_createdAt_idx" ON "ContratoStatusEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCompany_slug_key" ON "MarketingCompany"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAccount_username_key" ON "InstagramAccount"("username");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAccount_igUserId_key" ON "InstagramAccount"("igUserId");

-- CreateIndex
CREATE INDEX "AccountMetricsHistory_period_idx" ON "AccountMetricsHistory"("period");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMetricsHistory_accountId_metricName_period_key" ON "AccountMetricsHistory"("accountId", "metricName", "period");

-- CreateIndex
CREATE UNIQUE INDEX "MediaTypeStats_accountId_mediaType_period_key" ON "MediaTypeStats"("accountId", "mediaType", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_slug_key" ON "Employee"("slug");

-- CreateIndex
CREATE INDEX "Employee_userId_idx" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "MarketingTask_employeeId_status_idx" ON "MarketingTask"("employeeId", "status");

-- AddForeignKey
ALTER TABLE "InstagramAccount" ADD CONSTRAINT "InstagramAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "MarketingCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMetricsHistory" ADD CONSTRAINT "AccountMetricsHistory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaTypeStats" ADD CONSTRAINT "MediaTypeStats_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingTask" ADD CONSTRAINT "MarketingTask_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
