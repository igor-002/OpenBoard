-- CreateTable
CREATE TABLE "RelatorioDiario" (
    "id" TEXT NOT NULL,
    "vendedorIxcId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "contatos" INTEGER NOT NULL DEFAULT 0,
    "callsReunioes" INTEGER NOT NULL DEFAULT 0,
    "vendas" INTEGER NOT NULL DEFAULT 0,
    "valorCents" INTEGER NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatorioDiario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelatorioDiario_data_idx" ON "RelatorioDiario"("data");

-- CreateIndex
CREATE UNIQUE INDEX "RelatorioDiario_vendedorIxcId_data_key" ON "RelatorioDiario"("vendedorIxcId", "data");
