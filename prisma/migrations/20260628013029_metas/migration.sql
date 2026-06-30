-- CreateTable
CREATE TABLE "Meta" (
    "id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "metaContratos" INTEGER NOT NULL DEFAULT 0,
    "metaMrrCents" INTEGER NOT NULL DEFAULT 0,
    "metaSemanal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaVendedor" (
    "id" TEXT NOT NULL,
    "vendedorIxcId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "metaContratos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaVendedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Meta_mes_ano_key" ON "Meta"("mes", "ano");

-- CreateIndex
CREATE INDEX "MetaVendedor_mes_ano_idx" ON "MetaVendedor"("mes", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "MetaVendedor_vendedorIxcId_mes_ano_key" ON "MetaVendedor"("vendedorIxcId", "mes", "ano");
