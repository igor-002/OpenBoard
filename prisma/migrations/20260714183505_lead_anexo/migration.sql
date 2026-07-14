-- CreateTable
CREATE TABLE "LeadAnexo" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadAnexo_leadId_createdAt_idx" ON "LeadAnexo"("leadId", "createdAt");
