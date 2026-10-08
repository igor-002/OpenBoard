-- Quem faz parte da equipe de demandas. Começa falso pra todos: enquanto
-- ninguém for marcado, o sistema segue mostrando todos os usuários ativos.
ALTER TABLE "User" ADD COLUMN "equipe" BOOLEAN NOT NULL DEFAULT false;
