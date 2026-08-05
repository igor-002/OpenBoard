# Handoff — Vincular NOVA conta do Instagram ao app da Meta (OpenBoard)

> Cole isto no Claude Desktop. O Igor vai mandando prints do painel da Meta;
> seu trabalho é dizer **onde clicar em cada tela**, na ordem, até sair um token.

## Contexto

OpenBoard (Next.js, PT-BR) tem módulo **Marketing** que monitora contas do Instagram:
coleta seguidores, alcance, views, visualizações de perfil, engajamento e posts,
grava em tabelas locais e mostra em dashboards.

A integração usa a variante **"Instagram API com login do Instagram"**
(`graph.instagram.com`, v25.0) — **NÃO** a variante via Página do Facebook.
Consequências:
- Não precisa vincular Página do Facebook nem Business Manager.
- Não precisa do App Secret.
- O token gerado já é de longa duração (~60 dias, começa com `IGQ...`).

Um app da Meta **já existe e já funciona** com uma conta conectada. O objetivo agora
é só **adicionar mais uma conta** ao mesmo app. Não criar app novo.

## Objetivo

Sair da conversa com um **token de acesso de longa duração** da conta nova, que o
Igor vai colar em `/marketing/social/contas` no OpenBoard.

## Pré-requisitos

- Conta do Instagram nova precisa ser **Profissional** (Empresa ou Criador).
  Perfil pessoal não expõe insights — a API recusa.
- Igor precisa estar logado no Facebook com o usuário que é admin do app.

## Passo a passo (é isso que você guia pelos prints)

### 1. Adicionar a conta como testadora
Painel de Apps (`developers.facebook.com/apps`) → abre o app →
**Função do app → Funções → Testadores do Instagram → Adicionar pessoas** →
digita o `@` da conta nova → adiciona.

### 2. Aceitar o convite
Logado **na conta nova** em `instagram.com`:
Configurações → **Apps e sites → Convites de testador** → Aceitar.
(No app do celular: Configurações → Segurança/Apps e sites → Convites de testador.)

### 3. Gerar o token
Painel → card/caso de uso **Instagram** → **Configuração da API com login do Instagram**
→ seção **"Gerar tokens de acesso"** → **Adicionar conta** →
faz login **com a conta nova** (usar janela anônima; senão o popup reusa a sessão da
conta antiga e gera token da conta errada) → autoriza →
a conta aparece na lista → **Gerar token** → copiar.

Permissões esperadas na tela de autorização:
`instagram_business_basic` + `instagram_business_manage_insights`.

URLs diretas, se a navegação por menu se perder (trocar `<APP_ID>`):
- Token: `https://developers.facebook.com/apps/<APP_ID>/instagram-business/API-Setup/`
- Testadores: `https://developers.facebook.com/apps/<APP_ID>/roles/roles/`

### 4. Colar no OpenBoard (Igor faz sozinho, não precisa de você)
`/marketing/social/contas` → escolhe/cria a empresa → **Nova conta** (`@usuario` +
nome de exibição) → **Salvar** → na linha da conta clica **Conectar** → cola o token
→ **Conectar** → depois **Sincronizar** no topo pra puxar as métricas na hora.

## Armadilhas já pagas (não repetir)

- **Análise do app (App Review) NÃO é necessária.** A tela "Plataforma do Instagram /
  Casos de uso / Permissões e recursos" serve pra app público conectando contas de
  terceiros. App em **modo Desenvolvimento** funciona 100% com contas que têm papel
  no app. Se o Igor cair nessa tela, tire ele de lá.
- Se um dia precisar de review, o caso de uso certo é o **2º** ("gerenciar insights,
  moderação de comentários, conteúdo público").
- Popup de login reusando a sessão da conta antiga → token da conta errada.
  Sempre janela anônima. Conferir o `@` mostrado antes de gerar.
- Menu novo da Meta: **Painel** (produtos), **Configuração do app** (App ID/secret),
  **Função do app** (testadores), **Análise do app** (review — ignorar),
  **Ações necessárias**, **Alertas**.
- Conta com <100 seguidores: alguns insights vêm vazios. Esperado, não é erro.

## SEGURANÇA

O token `IGQ...` é credencial de acesso à conta. **Não** colar o token no chat, **não**
mandar print com o token visível, **não** salvar em arquivo do repositório.
Copiar direto da Meta e colar direto no OpenBoard.
No banco ele fica criptografado (AES-GCM, chave `TOKEN_ENC_KEY`).

## Depois de conectado (informativo)

- Renovação é automática: o sync renova o token quando faltam <10 dias.
  Só morre se ficar 60 dias sem sync rodar.
- Sync roda por cron in-process a cada 6h (`MARKETING_SYNC_INTERVAL_MIN`).
- Números do dashboard divergem do app do Instagram por **janela**
  (mês-calendário UTC × últimos-30-dias móvel do app). É esperado, não é bug.

## Regras

Responder em **PT-BR**. Sem inventar tela ou botão que não aparece no print —
se não der pra ver, pedir print de outro ângulo ou da URL.
