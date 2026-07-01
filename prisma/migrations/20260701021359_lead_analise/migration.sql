-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "analiseAt" TIMESTAMP(3),
ADD COLUMN     "analiseCustoUsdMicros" INTEGER,
ADD COLUMN     "analiseModelo" TEXT,
ADD COLUMN     "analiseNota" INTEGER,
ADD COLUMN     "analisePontos" JSONB,
ADD COLUMN     "analiseResumo" TEXT,
ADD COLUMN     "analiseTokensIn" INTEGER,
ADD COLUMN     "analiseTokensOut" INTEGER;

-- CreateTable
CREATE TABLE "LeadMensagem" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "remetente" TEXT,
    "mensagem" TEXT NOT NULL,
    "tipo" TEXT,
    "mensagemBot" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadMensagem_externalId_key" ON "LeadMensagem"("externalId");

-- CreateIndex
CREATE INDEX "LeadMensagem_leadId_idx" ON "LeadMensagem"("leadId");
