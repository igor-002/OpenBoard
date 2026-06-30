-- AlterTable
ALTER TABLE "Vendedor" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "incluirHistorico" BOOLEAN NOT NULL DEFAULT false;
