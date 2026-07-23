-- AlterTable
ALTER TABLE "SolicitacaoCadastro" ADD COLUMN     "planoAntigo" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'cadastro';
