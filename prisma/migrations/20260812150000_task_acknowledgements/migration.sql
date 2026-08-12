-- CreateTable
CREATE TABLE "TaskAcknowledgement" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskAcknowledgement_taskId_userId_key" ON "TaskAcknowledgement"("taskId", "userId");

-- CreateIndex
CREATE INDEX "TaskAcknowledgement_userId_receivedAt_idx" ON "TaskAcknowledgement"("userId", "receivedAt");

-- AddForeignKey
ALTER TABLE "TaskAcknowledgement" ADD CONSTRAINT "TaskAcknowledgement_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAcknowledgement" ADD CONSTRAINT "TaskAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
