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

## Deploy na VPS (produção)

Imagem Docker (Next standalone) + Postgres + Caddy (HTTPS automático). Pré-requisitos na VPS:
Docker + Docker Compose e um **domínio** apontando (registro A) para o IP da VPS.

```bash
# 1. Clonar o projeto na VPS e entrar na pasta
git clone <repo> openboard && cd openboard

# 2. Configurar variáveis de produção
cp .env.production.example .env.production
#   edite: POSTGRES_PASSWORD, AUTH_SECRET (openssl rand -base64 32), DOMAIN, ACME_EMAIL

# 3. Subir tudo (build da imagem + db + caddy). Migrations rodam sozinhas no start.
docker compose --env-file .env.production -f compose.prod.yml up -d --build

# 4. Criar o primeiro admin: acesse https://SEU_DOMINIO/register (abre só nessa 1ª vez).
#    (Opcional) popular dados de exemplo:
#    docker exec -it openboard-app node node_modules/prisma/build/index.js db seed   # requer tsx (dev) — em geral NÃO usar em prod
```

- **Migrations:** o serviço `migrate` roda `prisma migrate deploy` e encerra; o `app` só sobe depois que ele conclui (a cada `up`).
- **NÃO rode `db:seed` em produção** — ele apaga tudo e recria dados fictícios. O seed se recusa a rodar com `NODE_ENV=production` (só roda com `SEED_ALLOW_PROD=1`, o que **apaga dados reais**). Em produção, crie o admin via `/register` (1ª conta).
- **TLS:** o Caddy emite/renova certificado Let's Encrypt para `DOMAIN` automaticamente.
- **Backup:** `./scripts/backup.sh` faz `pg_dump` (agende no cron, ex. diário):
  `0 3 * * * cd /caminho/openboard && POSTGRES_USER=openboard POSTGRES_DB=openboard ./scripts/backup.sh`
- **Atualizar versão:** `git pull && docker compose --env-file .env.production -f compose.prod.yml up -d --build`

## Milestones

- **M1–M4 (feito):** fundação, Projetos, Kanban, Tempo/Time/Relatórios — todas com dados reais.
- **M4.5 (feito):** permissões (admin/membro) + gestão de usuários.
- **M5 (feito):** deploy VPS (Docker standalone + Caddy/TLS + backup).
- **Pendente:** Cronograma/Gantt (`/timeline`).
