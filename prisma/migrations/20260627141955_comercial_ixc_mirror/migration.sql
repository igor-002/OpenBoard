-- CreateTable
CREATE TABLE "Vendedor" (
    "id" TEXT NOT NULL,
    "ixcId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'A',
    "userId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IxcCliente" (
    "id" TEXT NOT NULL,
    "ixcId" TEXT NOT NULL,
    "razao" TEXT NOT NULL,
    "cnpjCpf" TEXT,
    "uf" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IxcCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" TEXT NOT NULL,
    "ixcId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'A',
    "filial" TEXT,
    "mrrCents" INTEGER NOT NULL DEFAULT 0,
    "taxaInstalacaoCents" INTEGER NOT NULL DEFAULT 0,
    "idVdContrato" TEXT,
    "dataAtivacao" TIMESTAMP(3),
    "dataCadastro" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clienteIxcId" TEXT NOT NULL,
    "vendedorIxcId" TEXT,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "fatalError" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendedor_ixcId_key" ON "Vendedor"("ixcId");

-- CreateIndex
CREATE INDEX "Vendedor_userId_idx" ON "Vendedor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IxcCliente_ixcId_key" ON "IxcCliente"("ixcId");

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_ixcId_key" ON "Contrato"("ixcId");

-- CreateIndex
CREATE INDEX "Contrato_status_idx" ON "Contrato"("status");

-- CreateIndex
CREATE INDEX "Contrato_vendedorIxcId_idx" ON "Contrato"("vendedorIxcId");

-- CreateIndex
CREATE INDEX "Contrato_clienteIxcId_idx" ON "Contrato"("clienteIxcId");

-- CreateIndex
CREATE INDEX "SyncRun_kind_startedAt_idx" ON "SyncRun"("kind", "startedAt");

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_clienteIxcId_fkey" FOREIGN KEY ("clienteIxcId") REFERENCES "IxcCliente"("ixcId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_vendedorIxcId_fkey" FOREIGN KEY ("vendedorIxcId") REFERENCES "Vendedor"("ixcId") ON DELETE SET NULL ON UPDATE CASCADE;
