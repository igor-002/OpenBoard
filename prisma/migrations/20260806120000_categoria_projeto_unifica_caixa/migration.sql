-- Categoria do projeto (Project.tag) passa a se comportar como lista: grafias
-- que só diferem em maiúscula/minúscula são a MESMA categoria. Aqui unifica o
-- que já está gravado, senão "hotspot" e "Hotspot" apareceriam como dois
-- filtros com cores diferentes.
--
-- Vencedora: a variante mais usada no workspace; empate resolve pelo nome.
WITH variantes AS (
  SELECT "workspaceId", BTRIM(tag) AS nome, COUNT(*) AS usos
  FROM "Project"
  WHERE BTRIM(tag) <> ''
  GROUP BY "workspaceId", BTRIM(tag)
),
canonica AS (
  SELECT "workspaceId",
         LOWER(nome) AS chave,
         (ARRAY_AGG(nome ORDER BY usos DESC, nome ASC))[1] AS nome
  FROM variantes
  GROUP BY "workspaceId", LOWER(nome)
)
UPDATE "Project" p
SET tag = c.nome
FROM canonica c
WHERE p."workspaceId" = c."workspaceId"
  AND LOWER(BTRIM(p.tag)) = c.chave
  AND p.tag <> c.nome;
