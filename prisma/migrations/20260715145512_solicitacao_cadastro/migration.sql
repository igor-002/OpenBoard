-- CreateTable
CREATE TABLE "SolicitacaoCadastro" (
    "id" TEXT NOT NULL,
    "solicitante" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "cnpjCpf" TEXT NOT NULL,
    "cnpjCpfNorm" TEXT,
    "rg" TEXT,
    "inscricaoEstadual" TEXT,
    "cidade" TEXT,
    "bairro" TEXT,
    "rua" TEXT,
    "pontoReferencia" TEXT,
    "cep" TEXT,
    "telefone1" TEXT NOT NULL,
    "telefone1Norm" TEXT,
    "telefone2" TEXT,
    "telefone2Norm" TEXT,
    "emailBoletos" TEXT,
    "vencimentoDia" INTEGER,
    "plano" TEXT,
    "valorCents" INTEGER NOT NULL DEFAULT 0,
    "observacao" TEXT,
    "situacao" TEXT NOT NULL DEFAULT 'normal',
    "prazoAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoAt" TIMESTAMP(3),
    "finalizadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitacaoCadastro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoCadastroEvent" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "movedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitacaoCadastroEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitacaoCadastro_status_createdAt_idx" ON "SolicitacaoCadastro"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SolicitacaoCadastro_cnpjCpfNorm_idx" ON "SolicitacaoCadastro"("cnpjCpfNorm");

-- CreateIndex
CREATE INDEX "SolicitacaoCadastroEvent_solicitacaoId_createdAt_idx" ON "SolicitacaoCadastroEvent"("solicitacaoId", "createdAt");

-- CreateIndex
CREATE INDEX "SolicitacaoCadastroEvent_toStatus_createdAt_idx" ON "SolicitacaoCadastroEvent"("toStatus", "createdAt");
