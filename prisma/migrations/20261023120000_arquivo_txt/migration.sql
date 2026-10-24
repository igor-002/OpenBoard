-- Arquivo .txt enviado pela página pública /arquivo-txt e puxado pelo PC de destino.
CREATE TABLE "ArquivoTxt" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "linhas" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicadoEm" TIMESTAMP(3),
    "aplicadoPor" TEXT,

    CONSTRAINT "ArquivoTxt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArquivoTxt_createdAt_idx" ON "ArquivoTxt"("createdAt");
