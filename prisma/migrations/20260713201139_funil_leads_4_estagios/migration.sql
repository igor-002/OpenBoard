-- Funil de leads enxuto: 4 estágios (contato, proposta, ganho=Aprovado,
-- perdido=Sem resposta). A pedido, a base de leads é ZERADA para recomeçar
-- no funil novo (leads, histórico de filas e mensagens de conversa).
DELETE FROM "LeadMensagem";
DELETE FROM "LeadStageEvent";
DELETE FROM "Lead";

-- Motivo de perda saiu do fluxo (a coluna "Sem resposta" já é o motivo).
ALTER TABLE "Lead" DROP COLUMN "motivoPerda",
ALTER COLUMN "stage" SET DEFAULT 'contato';
