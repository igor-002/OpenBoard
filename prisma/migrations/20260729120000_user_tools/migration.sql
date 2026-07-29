-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "manages" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Ninguém pode perder acesso na virada: quem tinha um módulo recebe TODAS as
-- ferramentas dele. A partir daí o admin tira o que não fizer sentido.
UPDATE "User" SET "tools" = (
  SELECT COALESCE(ARRAY_AGG(t), ARRAY[]::TEXT[]) FROM UNNEST(ARRAY[
    'gestao.dashboard','gestao.projetos','gestao.tarefas','gestao.atividades',
    'gestao.cronograma','gestao.tempo','gestao.time','gestao.relatorios',
    'comercial.visao','comercial.cadastros','comercial.contratos','comercial.clientes',
    'comercial.pipeline','comercial.vendedores','comercial.relatorios','comercial.churn',
    'comercial.mrr','comercial.sync','comercial.config',
    'leads.funil','margem.painel',
    'marketing.quadro','marketing.demandas','marketing.relatorios','marketing.equipe',
    'marketing.social','marketing.contas','marketing.links','marketing.cliques'
  ]) AS t
  WHERE SPLIT_PART(t, '.', 1) = ANY("User"."modules")
)
WHERE CARDINALITY("modules") > 0;
