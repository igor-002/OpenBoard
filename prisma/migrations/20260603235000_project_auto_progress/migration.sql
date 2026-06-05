-- Progresso do projeto: campo manual vira override opcional (null = automático por tarefas)
ALTER TABLE "Project" DROP COLUMN "progress";
ALTER TABLE "Project" ADD COLUMN "manualProgress" INTEGER;
