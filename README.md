# OpenBoard — Controle de Projetos

App de gestão de projetos (PT-BR), multi-usuário. Next.js 15 (App Router) + TypeScript,
PostgreSQL + Prisma, auth email+senha (JWT em cookie httpOnly). Local primeiro, depois VPS.

O design system veio de um protótipo do Claude Design e foi portado 1:1 (CSS em
`src/app/globals.css`, gráficos SVG sem libs).

## Pré-requisitos

- Node 20+ e npm
- Docker (para o Postgres local)

## Rodar local (primeira vez)

```bash
npm install
cp .env.example .env          # ajuste AUTH_SECRET (openssl rand -base64 32)
npm run db:up                 # sobe o Postgres (docker compose)
npm run db:migrate            # cria as tabelas
npm run db:seed               # popula dados fictícios
npm run dev                   # http://localhost:3000
```

Login de teste (vem do seed): **marina@openboard.dev** / **openboard123**
(todos os usuários do seed usam a mesma senha). Ou crie a sua conta em `/register`.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm run start` | Build de produção / servir |
| `npm run db:up` | Sobe o Postgres (Docker) |
| `npm run db:migrate` | Aplica migrations (Prisma) |
| `npm run db:seed` | Popula o banco com dados fictícios |
| `npm run db:studio` | Prisma Studio (inspecionar o banco) |

## Estrutura

```
src/
  app/
    (auth)/         login, register, server actions
    (app)/          telas autenticadas (layout = AppShell)
      dashboard/    ← ligado ao banco (M1)
      projects, kanban, timeline, time, team, reports  ← placeholders (M2–M4)
  components/
    ui/             Icon, Avatar, Badge, Card, StatCard, Progress
    charts/         HoursBarChart, Donut, LineChart (SVG)
    layout/         Sidebar, Topbar, AppShell, ComingSoon
    tweaks/         TweaksPanel (tema ao vivo)
    project/        ProjectRow
  lib/              db, auth, jwt, password, format, meta, types
  server/           queries do servidor (dashboard.ts)
  proxy.ts          guarda de rotas (sessão)
prisma/             schema.prisma, seed.ts, migrations
```

## Papéis (RBAC)

Dois papéis: **admin** e **membro**. Só admin gerencia usuários (Admin › Usuários):
criar/convidar, mudar papel e remover. `/register` fica aberto **apenas** para criar o
primeiro usuário (vira admin); depois novos acessos são por convite do admin.

## Deploy na VPS (sob `IP/openboard`, atrás do nginx existente)

Imagem Docker (Next standalone) + Postgres. **Sem domínio/HTTPS próprio** — o app roda em
subcaminho (`basePath /openboard`, definido no Dockerfile) e o **nginx já existente da VPS**
faz o proxy de `/openboard` pra porta local do container.

```bash
# 1. Clonar
git clone https://github.com/igor-002/OpenBoard.git openboard && cd openboard

# 2. Variáveis de produção
cp .env.production.example .env.production
#   edite: POSTGRES_PASSWORD, AUTH_SECRET (openssl rand -base64 32), APP_PORT (ex. 3001)

# 3. Subir (build + db + migrations + app). App escuta em 127.0.0.1:APP_PORT/openboard
docker compose --env-file .env.production -f compose.prod.yml up -d --build

# 4. Proxy: cole o conteúdo de deploy/nginx-openboard.conf dentro do server { } do nginx,
#    ajuste a porta se mudou APP_PORT, e recarregue:
sudo nginx -t && sudo systemctl reload nginx

# 5. Criar o admin: acesse http://SEU_IP/openboard/register (abre só na 1ª vez).
```

- **basePath:** `/openboard` é "assado" no build (Dockerfile `ENV BASE_PATH=/openboard`). Outro prefixo → mude lá e rebuild.
- **Migrations:** serviço `migrate` roda `prisma migrate deploy` e o `app` só sobe depois (a cada `up`).
- **NÃO rode `db:seed` em produção** — apaga tudo (tem trava `NODE_ENV=production`). Admin via `/register`.
- **Backup:** `./scripts/backup.sh` (`pg_dump`) — cron diário:
  `0 3 * * * cd /caminho/openboard && POSTGRES_USER=openboard POSTGRES_DB=openboard ./scripts/backup.sh`
- **Atualizar:** `git pull && docker compose --env-file .env.production -f compose.prod.yml up -d --build`

## Milestones

- **M1–M4 (feito):** fundação, Projetos, Kanban, Tempo/Time/Relatórios — todas com dados reais.
- **M4.5 (feito):** permissões (admin/membro) + gestão de usuários.
- **M5 (feito):** deploy VPS (Docker standalone + Caddy/TLS + backup).
- **Pendente:** Cronograma/Gantt (`/timeline`).
