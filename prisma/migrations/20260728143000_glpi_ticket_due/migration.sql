-- AlterTable
ALTER TABLE "GlpiTicket" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "dueSetById" TEXT;

-- CreateIndex
CREATE INDEX "GlpiTicket_dueAt_idx" ON "GlpiTicket"("dueAt");
