# Prompt — Sistema de Encurtador de Links Dinâmicos + QR Code + Analytics

> Cole isto no Claude Code como handoff. Ajuste a stack/domínio nas seções marcadas com `[AJUSTAR]`.

---

## Contexto e objetivo

Quero construir um sistema self-hosted de **encurtamento de links dinâmicos com geração de QR Code e rastreamento de métricas**, no estilo Bitly, focado em campanhas de marketing e panfletagem física (QR impresso em panfleto/cartaz).

O diferencial central é o **link dinâmico**: o QR Code aponta sempre para a URL curta do meu sistema, **nunca** para o destino final. Assim eu consigo trocar o destino (ex: mudar o número de WhatsApp de atendimento, corrigir uma landing page que caiu) editando só no painel — e o QR já impresso no papel continua funcionando.

## Stack `[AJUSTAR]`

- **Frontend (painel):** React 19 + TypeScript + Vite + Tailwind v4
- **Backend / redirect:** Node.js + Express (rodando no meu VPS AlmaLinux com PM2 + nginx)
- **Banco:** Supabase (Postgres)
- **Geração de QR:** biblioteca `qrcode` (PNG e SVG)
- **Parse de dispositivo:** `ua-parser-js`
- **Geolocalização por IP:** MaxMind GeoLite2 local (preferível, sem custo por request) OU uma API tipo `ip-api.com` como fallback
- **Domínio curto próprio:** `[AJUSTAR: ex. op.li ou link.openit.com.br]`

## Funcionalidades

### 1. Links curtos dinâmicos
- Criar link com **slug aleatório** (6–7 chars, base62) ou **slug personalizado** escolhido pelo usuário.
- Campo de **destino editável a qualquer momento** — sem alterar a URL curta nem o QR.
- Metadados: título, campanha/tag, status ativo/inativo, data de criação, dono (user_id).
- Poder **desativar** um link (retorna uma página de "link indisponível" em vez de 404 seco).
- Opcional: data de expiração.

### 2. Geração de QR Code
- Gerar QR automaticamente **apontando para a URL curta** (não para o destino).
- Exportar em **PNG e SVG** (SVG é essencial pra impressão em alta qualidade).
- Customização: cor do QR e do fundo, e opção de **logo no centro** (com margem de correção de erro adequada, nível H quando tiver logo).
- Botão de download direto no painel.

### 3. Rastreamento / Analytics
Cada acesso ao link curto deve registrar:
- Total de cliques/escaneamentos (contagem agregada + eventos individuais).
- **Geolocalização** por IP: país, estado/região, cidade.
- **Data e hora** do acesso.
- **Dispositivo:** tipo (mobile/tablet/desktop), sistema operacional, navegador.
- **Referrer/origem** quando disponível.

> IMPORTANTE: o registro do analytics deve ser **assíncrono** — dispara o redirect (302) o mais rápido possível e grava o evento em background. O usuário que escaneou não pode esperar a gravação no banco.

### 4. Dashboard (painel React)
- Lista de todos os links com métricas resumidas (total de cliques, criado em, status).
- Filtro/busca por campanha, tag ou texto.
- Tela de detalhe por link com:
  - Gráfico de **cliques ao longo do tempo** (linha/barra).
  - **Breakdown por dispositivo** (pizza/donut).
  - **Distribuição geográfica** (lista por estado/país, ou mapa se rolar).
  - Tabela dos últimos acessos.
- Ações: criar, editar destino, gerar/baixar QR, desativar, deletar.

### 5. Organização e multiusuário
- Agrupar links por **campanha** e/ou **tags**.
- Autenticação via Supabase Auth. Cada usuário vê só seus próprios links (RLS ligado no Postgres).

## Schema inicial do banco (esboço — ajuste conforme necessário)

```sql
-- Links
create table links (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  destino_url text not null,
  titulo      text,
  campanha_id uuid references campanhas(id),
  ativo       boolean not null default true,
  expira_em   timestamptz,
  user_id     uuid references auth.users(id) not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Eventos de clique/scan
create table clicks (
  id          bigint generated always as identity primary key,
  link_id     uuid references links(id) on delete cascade not null,
  ocorreu_em  timestamptz not null default now(),
  ip_hash     text,           -- ver nota de LGPD abaixo
  pais        text,
  estado      text,
  cidade      text,
  device_type text,           -- mobile | tablet | desktop
  os          text,
  browser     text,
  referrer    text
);
create index on clicks (link_id, ocorreu_em);

-- Campanhas
create table campanhas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  user_id    uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);
```

## Requisitos técnicos e cuidados

1. **Redirect rápido:** rota `GET /:slug` faz lookup do slug → responde `302` para o destino → grava o evento de analytics de forma assíncrona (fila em memória, `setImmediate`, ou uma tabela de staging). Nunca bloquear o redirect esperando geolocalização.
2. **Cache do lookup de slug:** cachear os slugs mais acessados (Redis ou cache em memória) pra não bater no banco a cada scan.
3. **QR aponta para a URL curta**, nunca para o destino — é isso que permite trocar o destino depois.
4. **LGPD (importante, Brasil):** IP é dado pessoal. Não guardar IP em texto puro — armazenar só o resultado da geolocalização (país/estado/cidade) e, se precisar do IP pra deduplicação, guardar um **hash**. Ter aviso de uso na landing/painel.
5. **Deploy no VPS:** app Node com PM2, nginx como proxy reverso, e o domínio curto apontando pro serviço. O painel React pode ficar num subdomínio separado (ex: `painel.dominio`).

## Entregáveis nesta primeira fase

1. Backend do redirect + registro de analytics (rota `/:slug`).
2. CRUD de links + geração de QR (endpoints).
3. Painel React com listagem, criação e tela de detalhe com os gráficos.
4. Migrations do Supabase com RLS configurado.
5. README com passos de deploy no VPS (PM2 + nginx).

Comece confirmando a stack e o schema comigo, depois monte a estrutura de pastas antes de escrever código.
