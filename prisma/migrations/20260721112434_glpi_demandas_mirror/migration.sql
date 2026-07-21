-- CreateTable
CREATE TABLE "GlpiTicket" (
    "id" TEXT NOT NULL,
    "glpiId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "statusId" INTEGER NOT NULL,
    "statusName" TEXT NOT NULL DEFAULT '',
    "typeId" INTEGER NOT NULL DEFAULT 0,
    "urgency" INTEGER NOT NULL DEFAULT 0,
    "impact" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "requesterId" INTEGER NOT NULL,
    "requesterLogin" TEXT NOT NULL DEFAULT '',
    "requesterName" TEXT NOT NULL DEFAULT '',
    "assignees" TEXT NOT NULL DEFAULT '',
    "entityName" TEXT NOT NULL DEFAULT '',
    "requestType" TEXT NOT NULL DEFAULT '',
    "categoryName" TEXT,
    "locationName" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL,
    "dateMod" TIMESTAMP(3),
    "dateSolve" TIMESTAMP(3),
    "dateClose" TIMESTAMP(3),
    "resolutionDuration" INTEGER,
    "closeDuration" INTEGER,
    "waitingDuration" INTEGER,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlpiTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlpiSyncRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'tickets',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "fatalError" TEXT,

    CONSTRAINT "GlpiSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlpiTicket_glpiId_key" ON "GlpiTicket"("glpiId");

-- CreateIndex
CREATE INDEX "GlpiTicket_requesterId_statusId_idx" ON "GlpiTicket"("requesterId", "statusId");

-- CreateIndex
CREATE INDEX "GlpiTicket_dateCreation_idx" ON "GlpiTicket"("dateCreation");

-- CreateIndex
CREATE INDEX "GlpiSyncRun_startedAt_idx" ON "GlpiSyncRun"("startedAt");
