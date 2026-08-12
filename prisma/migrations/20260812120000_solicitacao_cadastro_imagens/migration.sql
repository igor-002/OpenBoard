-- CreateTable
CREATE TABLE "SolicitacaoCadastroImagem" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitacaoCadastroImagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitacaoCadastroImagem_solicitacaoId_createdAt_idx" ON "SolicitacaoCadastroImagem"("solicitacaoId", "createdAt");

-- AddForeignKey
ALTER TABLE "SolicitacaoCadastroImagem" ADD CONSTRAINT "SolicitacaoCadastroImagem_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoCadastro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
