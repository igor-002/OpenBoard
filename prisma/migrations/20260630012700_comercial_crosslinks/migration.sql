-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "ixcClienteId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hourlyCostCents" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Project_ixcClienteId_idx" ON "Project"("ixcClienteId");
