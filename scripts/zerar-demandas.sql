-- Zera demandas e projetos do sistema PRINCIPAL. Comercial e Marketing não são
-- tocados (Lead, Contrato, IxcCliente, MktCard, GlpiTicket, MarketingTask… ficam).
--
-- IRREVERSÍVEL depois do COMMIT. Faça backup antes:  ./scripts/backup.sh
--
-- Uso (na VPS, dentro de ~/openboard):
--   ensaio (não grava nada, só mostra as contagens):
--     docker exec -i openboard-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v confirma=0' < scripts/zerar-demandas.sql
--   pra valer:
--     ... -v confirma=1 ...
--
-- Apaga:
--   · Task (todas) → junto: Subtask, TaskComment, TaskAcknowledgement, TaskTag, TaskEvent
--   · Project (todos) → junto: ProjectMember, Milestone, TimeLog, ProjectNote
--   · Notification de tarefa/projeto (as do Comercial/Marketing ficam)
-- Mantém:
--   · Note (/notas): só perde o vínculo com a tarefa/projeto apagado
--   · ProjectClient e ProjectCategory (cadastros, não são projetos)
--   · IntegrationEvent: fica de propósito, pra um negócio antigo do Ploomes
--     reenviado NÃO recriar o projeto apagado

\set ON_ERROR_STOP on
BEGIN;

\echo '--- ANTES ---'
SELECT 'Task' AS tabela, count(*) FROM "Task"
UNION ALL SELECT 'Project', count(*) FROM "Project"
UNION ALL SELECT 'TaskComment', count(*) FROM "TaskComment"
UNION ALL SELECT 'Subtask', count(*) FROM "Subtask"
UNION ALL SELECT 'Milestone', count(*) FROM "Milestone"
UNION ALL SELECT 'TimeLog', count(*) FROM "TimeLog"
UNION ALL SELECT 'ProjectNote', count(*) FROM "ProjectNote"
UNION ALL SELECT 'Notification (tarefa/projeto)', count(*) FROM "Notification"
  WHERE "type" IN ('task_assigned', 'task_created', 'note_added', 'project_created', 'project_member', 'project_deadline')
UNION ALL SELECT 'Note com vinculo (so desvincula)', count(*) FROM "Note" WHERE "taskId" IS NOT NULL OR "projectId" IS NOT NULL;

-- Contagens de controle: o que NÃO pode mudar.
CREATE TEMP TABLE _controle ON COMMIT DROP AS
SELECT (SELECT count(*) FROM "Note") AS notas,
       (SELECT count(*) FROM "User") AS usuarios,
       (SELECT count(*) FROM "Lead") AS leads,
       (SELECT count(*) FROM "Contrato") AS contratos,
       (SELECT count(*) FROM "IxcCliente") AS clientes,
       (SELECT count(*) FROM "MktCard") AS mkt_cards,
       (SELECT count(*) FROM "GlpiTicket") AS glpi,
       (SELECT count(*) FROM "ProjectClient") AS clientes_projeto;

DELETE FROM "Task";
DELETE FROM "Project";
DELETE FROM "Notification"
  WHERE "type" IN ('task_assigned', 'task_created', 'note_added', 'project_created', 'project_member', 'project_deadline');

-- Numeração de demanda volta pro #1 (só existe depois da migration demanda_chamado).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'Task_numero_seq') THEN
    PERFORM setval('"Task_numero_seq"', 1, false);
  END IF;
END $$;

\echo '--- DEPOIS ---'
SELECT 'Task' AS tabela, count(*) FROM "Task"
UNION ALL SELECT 'Project', count(*) FROM "Project"
UNION ALL SELECT 'TaskComment', count(*) FROM "TaskComment"
UNION ALL SELECT 'Subtask', count(*) FROM "Subtask"
UNION ALL SELECT 'Milestone', count(*) FROM "Milestone"
UNION ALL SELECT 'TimeLog', count(*) FROM "TimeLog"
UNION ALL SELECT 'ProjectNote', count(*) FROM "ProjectNote";

-- Aborta tudo se qualquer coisa fora do escopo mudou.
DO $$
DECLARE c _controle%ROWTYPE;
BEGIN
  SELECT * INTO c FROM _controle;
  IF c.notas <> (SELECT count(*) FROM "Note")
     OR c.usuarios <> (SELECT count(*) FROM "User")
     OR c.leads <> (SELECT count(*) FROM "Lead")
     OR c.contratos <> (SELECT count(*) FROM "Contrato")
     OR c.clientes <> (SELECT count(*) FROM "IxcCliente")
     OR c.mkt_cards <> (SELECT count(*) FROM "MktCard")
     OR c.glpi <> (SELECT count(*) FROM "GlpiTicket")
     OR c.clientes_projeto <> (SELECT count(*) FROM "ProjectClient") THEN
    RAISE EXCEPTION 'Algo fora do escopo mudou — nada foi gravado.';
  END IF;
END $$;
\echo 'Controle ok: notas, usuarios, Comercial e Marketing intactos.'

\if :confirma
  COMMIT;
  \echo 'GRAVADO. Demandas e projetos zerados.'
\else
  ROLLBACK;
  \echo 'ENSAIO: nada foi gravado. Rode de novo com -v confirma=1 pra valer.'
\endif
