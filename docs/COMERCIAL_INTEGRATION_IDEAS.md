# Integrações Comercial (IXC) ↔ Gestão de Projetos (OpenBoard)

> Rascunho para análise. Lista de pontos de integração entre o segundo sistema
> (Comercial / IXC) e o OpenBoard. Cada item tem **valor**, **esforço** e o que
> reusa do que já existe. Decidir depois quais entram no roadmap.

Hoje os dois sistemas compartilham: mesma sessão/usuários, mesmo tema/UI, mesmo
banco. O espelho IXC (`Vendedor`, `IxcCliente`, `Contrato`, MRR) já está local —
isso destrava cruzar dado comercial com projeto **sem bater no IXC em tempo real**.

---

## A. Camada de vínculo (base — fazer primeiro)

Sem isso o resto não conecta. São os "join keys" entre os dois mundos.

### A1. Vendedor ↔ User
- **O quê:** mapear `Vendedor.userId` → `User` do OpenBoard (campo já existe no schema, hoje nulo).
- **Destrava:** ranking de vendas por pessoa real, comissão, "meus contratos" e "meus projetos" na mesma conta.
- **Valor:** alto · **Esforço:** baixo (UI de mapeamento em settings + match por nome/email).

### A2. Cliente IXC ↔ Cliente do Projeto
- **O quê:** ligar `IxcCliente` ao campo `Project.client` (hoje string solta). Criar entidade `Cliente` única OU FK frouxa por `ixcId`.
- **Destrava:** visão 360 (contratos + projetos do mesmo cliente), dedupe de nomes.
- **Valor:** alto · **Esforço:** médio (normalizar `Project.client`, hoje texto livre).

---

## B. Automações (evento comercial → ação no projeto)

### B1. Venda fechada → Projeto de implantação automático ⭐
- **O quê:** contrato vira `A` (ativado) e produto exige implantação → cria `Project` automaticamente (onboarding do cliente), com cliente, vendedor como lead e prazo inicial.
- **Reusa:** `server/projects.ts`, bus SSE de eventos, notificações.
- **Valor:** muito alto (elimina retrabalho manual) · **Esforço:** médio.

### B2. Contrato em atraso (`FA`) → tarefa de cobrança/retenção
- **O quê:** status `FA`/`N` cria `Task` num projeto/board de retenção e notifica responsável.
- **Reusa:** `server/tasks.ts`, `notify()`.
- **Valor:** médio · **Esforço:** baixo.

### B3. SLA de pipeline (dias aguardando assinatura)
- **O quê:** contrato `AA`/`P` parado há X dias (handoff §7 — "dias aguardando") → alerta/tarefa pra cobrar fechamento.
- **Reusa:** `deadlineInfo()` (já calcula dias/atraso), notificações.
- **Valor:** médio · **Esforço:** baixo.

---

## C. Visões unificadas (cross-link de navegação)

### C1. Cliente 360 ⭐
- **O quê:** página única do cliente: contratos IXC (MRR, status) + projetos OpenBoard + tarefas + notas, com deep-links cruzados.
- **Valor:** alto · **Esforço:** médio (depende de A2).

### C2. KPIs comerciais no dashboard do OpenBoard (e vice-versa)
- **O quê:** card "MRR ativo / vendas do mês / pipeline" no dashboard principal; e KPIs de entrega (projetos no prazo) no dashboard comercial.
- **Reusa:** `StatCard`, queries já prontas em `server/comercial/queries.ts`.
- **Valor:** alto · **Esforço:** baixo.

### C3. Pipeline comercial em Kanban
- **O quê:** contratos `AA`/`P` como cards num board (colunas = etapas do funil), reusando o KanbanBoard.
- **Reusa:** `components/task/KanbanBoard.tsx` (dnd-kit).
- **Valor:** médio · **Esforço:** médio.

### C4. Painel comercial no TV (kiosk)
- **O quê:** adicionar painéis rotativos de MRR/ranking/pipeline ao `/tv` existente.
- **Reusa:** `TvBoard`, rotação de 6 painéis já feita.
- **Valor:** médio · **Esforço:** baixo.

---

## D. Analytics combinado (o pulo do gato)

### D1. Margem real por cliente/projeto ⭐
- **O quê:** receita (MRR + taxa instalação do IXC) **vs** custo (horas apontadas × custo/hora do time no OpenBoard) → margem real por cliente.
- **Reusa:** `TimeLog` (horas), MRR do espelho.
- **Valor:** muito alto (decisão de negócio) · **Esforço:** alto (precisa custo/hora por user).

### D2. Receita por vendedor × entrega
- **O quê:** cruzar vendas do vendedor com saúde dos projetos que ele originou (no prazo? atrasados?).
- **Valor:** médio · **Esforço:** médio (depende de A1).

### D3. Marcos de ativação no cronograma
- **O quê:** ativações de contrato como marcos no `/timeline`.
- **Valor:** baixo · **Esforço:** baixo.

---

## Sugestão de ordem (1ª onda)
1. **A1 + A2** (vínculos) — base de tudo, esforço baixo/médio.
2. **C2** (KPIs cruzados no dashboard) — ganho visível rápido, reusa o que já existe.
3. **B1** (venda → projeto automático) — maior impacto operacional.
4. **C1** (Cliente 360) — consolida a narrativa "um sistema só".
5. **D1** (margem real) — quando houver custo/hora cadastrado.

> Itens marcados ⭐ = maior retorno percebido. Reavaliar prioridade junto.
