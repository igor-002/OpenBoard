-- "Aparece no Relatório Diário" (aba /comercial/relatorios?aba=diario).
-- Separado de "ativo" de propósito: `ativo=false` tira o vendedor de TODO o módulo
-- comercial (MRR, contratos, ranking, churn). Default true = ninguém some ao migrar.
ALTER TABLE "Vendedor" ADD COLUMN "incluirDiario" BOOLEAN NOT NULL DEFAULT true;
