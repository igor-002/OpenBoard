-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "empresa" TEXT,
    "cnpjCpf" TEXT,
    "cnpjCpfNorm" TEXT,
    "contato" TEXT,
    "contatoNorm" TEXT,
    "email" TEXT,
    "emailNorm" TEXT,
    "origem" TEXT,
    "externalId" TEXT,
    "valorEstimadoCents" INTEGER NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'novo',
    "order" INTEGER NOT NULL DEFAULT 0,
    "ixcClienteId" TEXT,
    "assignedUserId" TEXT,
    "payload" JSONB,
    "lastContactAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_externalId_key" ON "Lead"("externalId");

-- CreateIndex
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");

-- CreateIndex
CREATE INDEX "Lead_cnpjCpfNorm_idx" ON "Lead"("cnpjCpfNorm");

-- CreateIndex
CREATE INDEX "Lead_contatoNorm_idx" ON "Lead"("contatoNorm");

-- CreateIndex
CREATE INDEX "Lead_emailNorm_idx" ON "Lead"("emailNorm");
