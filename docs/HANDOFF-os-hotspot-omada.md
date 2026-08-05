# Handoff — Fechar OS de "Hotspot sem uso" cruzando IXC × Omada

> Para o Claude/dev do **sistema de APs (Omada)**. O OpenBoard **não participa** desta
> integração — ele só emprestou a documentação e as credenciais do IXC. Tudo roda no
> sistema de APs.

---

## 1. O problema

O IXC gera automaticamente Ordens de Serviço do assunto **"Hotspot sem uso"**. Muitas
dessas OS são falso-positivo: o cliente está online e usando normalmente. Alguém precisa
abrir uma por uma e fechar na mão.

**Objetivo:** cruzar essas OS com o estado real das APs no Omada e finalizar
automaticamente as que forem falso-positivo — deixando para o humano só o que é problema
de verdade.

---

## 2. Por que é viável neste caso

O elo que normalmente inviabiliza esse cruzamento — ligar a OS do ERP ao equipamento na
controladora — **já existe**: o sistema de APs lista todas as APs e cada uma carrega o
**código do cliente no IXC**. Esse campo é a chave da junção.

```
OS do IXC (id_cliente)  ←→  AP no sistema (código do cliente IXC)  ←→  device no Omada
```

Sem esse de-para, o projeto não existiria. Com ele, o resto é encanamento.

---

## 3. Identificação das OS no IXC

As OS de interesse têm:

| Campo | Valor |
|---|---|
| Assunto | **223** — "Hotspot sem uso" |
| Setor | **64** — Suporte dev |
| Filial | **6** |

Tabela: `su_oss_chamado`. Filtrar também por status em aberto (não pegar OS já finalizada
ou cancelada — confirmar o vocabulário de status na base real, ver §7).

> **Atenção ao `qtype`:** o campo precisa vir com prefixo da tabela
> (`su_oss_chamado.id_assunto`), senão a API responde **500**. Ver §6.

---

## 4. A regra de decisão (três estados)

Para cada OS aberta → acha o cliente → acha as APs daquele cliente → decide:

| Estado da AP | Ação |
|---|---|
| **Online COM uso** | Finaliza a OS. É falso-positivo. |
| **Online SEM uso** | **Não fecha.** Entra numa lista separada para revisão humana. |
| **Offline** | Não fecha. A OS está certa, é problema real. |

**Cliente com várias APs:** definir a regra explicitamente. A recomendação é
*qualquer AP com uso já fecha a OS* — a OS é do cliente, não do equipamento.

### Fases de implantação (decisão tomada)

1. **Fase 1 — fila com aprovação.** O sistema mostra "OS 1234 pode fechar — AP online com
   uso", com um botão. Nada é escrito no IXC sem clique humano.
2. **Fase 2 — automático.** Só depois de validar, com dados reais, que o cruzamento acerta.

Escrita em ERP de produção não se estreia no automático. Reabrir OS errada no IXC dá
trabalho e suja o histórico do cliente.

---

## 5. Os cinco pontos que decidem se dá certo

### 5.1 "Uso" não pode ser snapshot instantâneo
Se a verificação rodar às 3h da manhã, **toda** AP está vazia — e clientes bons vão para a
lista de problema. Um AP pode legitimamente estar sem ninguém conectado no instante da
consulta.

**Como resolver:** o sistema já varre as APs em ciclo. A cada varredura, gravar o
**contador de tráfego acumulado** do device. "Uso" = o contador subiu ao longo de N dias.
Isso é muito mais confiável que "tem cliente conectado agora".

O Omada expõe, por device, clientes conectados e contadores de tráfego (download/upload) —
confirmar os nomes exatos dos campos na versão da controladora em uso.

### 5.2 Loop de reabertura — o risco mais chato
Se o robô do IXC que **gera** as OS continuar com o mesmo critério, ele vai recriar a OS do
mesmo cliente na próxima rodada. O robô fecha, o IXC reabre, para sempre.

**Antes de ligar o automático**, olhar o que dispara o gerador de OS. Se o critério dele for
o mesmo "sem uso" que este projeto vai medir melhor, o certo é **corrigir o gerador**, não
ficar limpando atrás dele. Alternativa paliativa: lista de exclusão dos clientes já
validados.

### 5.3 Escrita no IXC é o único risco técnico real
Ver §7. É o pedaço não mapeado.

### 5.4 Rastro obrigatório
Toda OS fechada pelo robô deve levar uma mensagem explicando o motivo — algo como
*"Finalizada automaticamente: AP {nome} online com tráfego nos últimos N dias"* — mais log
do lado do sistema de APs (qual OS, qual AP, qual medição, quando, quem aprovou).

Sem isso ninguém consegue auditar depois, nem descobrir que o critério estava errado.

### 5.5 O subproduto mais valioso
A lista **"online SEM uso"** não é só fila de suporte: é **cliente pagando hotspot que não
usa**. Isso é risco de cancelamento e material de abordagem comercial. Vale entregar essa
lista para o comercial, não só para o suporte.

---

## 6. IXC — leitura (documentado e testado)

**Documentação completa:** `docs/IXC_INTEGRATION_HANDOFF.md` no repositório OpenBoard.
186 linhas cobrindo autenticação, proxy/CORS, padrão de query, armadilhas, endpoints,
códigos de erro e variáveis de ambiente.

**Implementação de referência:** `src/lib/ixc.ts` no OpenBoard (172 linhas) — já trata todas
as armadilhas abaixo. Vale ler antes de escrever do zero.

### Essencial para começar

- **Base:** `https://{dominio}/webservice/v1/{tabela}`
- **Listagem é POST**, com os filtros no corpo JSON.
- **Header `ixcsoft: listar` é obrigatório** em toda listagem. Sem ele → **404**.
- **Auth:** `Authorization: Basic <base64(usuario:senha)>`, ou o token gerado no painel
  (Configurações → Usuários → [usuário] → Token de acesso).
- **Filtro:** trio `qtype` (campo **com prefixo da tabela**), `query` (valor), `oper`
  (`=`, `>=`, `<=`, `>`, `<`, `L`). Sem prefixo → **500**.
- **Paginação:** `page`, `rp`, `sortname`, `sortorder`. Para varrer tudo, laço
  `do/while` enquanto `(page-1)*rp < total`, usando o `total` da resposta — e parar se vier
  página vazia, porque o `total` às vezes mente.

### Armadilhas já pagas (não redescobrir)

1. **`registros` tem formato inconsistente** — ora array, ora objeto indexado
   (`{"0":{...},"1":{...}}`), ora vazio. **Sempre normalizar**: array → usa direto; objeto →
   `Object.values`; senão → lista vazia. Sem isso a integração quebra em silêncio.
2. **Datas nulas** vêm como `"0000-00-00"` — tratar como null.
3. **Wall-clock sem fuso** (`"2026-06-01 00:00:00"`) — parsear como UTC para não deslocar
   virada de dia/mês.
4. **Dinheiro** vem ora `"123.45"`, ora BR `"1.234,56"`.
5. **Concorrência:** processar em lotes (~10) com falha individual isolada, senão uma OS
   problemática aborta a rodada inteira.

### Códigos de erro

| Código | Causa |
|---|---|
| 400 | Erro SSL ou auth diferente de Basic |
| 401 | Token inválido ou usuário inativo |
| 403 | Token gerado em servidor antigo (pós-migração) |
| 404 | Falta o header `ixcsoft: listar` |
| 500 | Endpoint errado ou `qtype` sem prefixo de tabela |
| 504 | Timeout do IXC (alta demanda) |

---

## 7. IXC — escrita: o pedaço NÃO mapeado

**Nada disto está documentado no handoff do OpenBoard**, que é 100% leitura. A tabela
`su_oss_chamado` nunca foi usada lá. Portanto:

- A edição no IXC v1 é, em geral, `PUT /webservice/v1/{tabela}/{id}` com header
  `ixcsoft: editar` — **confirmar na documentação oficial do IXC**, não assumir.
- **Risco grave:** em várias tabelas o IXC espera o **registro inteiro** no corpo. Mandar só
  o campo `status` pode **zerar os demais campos** da OS.
- Finalizar uma OS normalmente exige mais que o status: data final, técnico, e uma mensagem
  de encerramento. Descobrir os campos reais listando uma OS já finalizada e comparando com
  uma aberta.

**Protocolo obrigatório antes de rodar em lote:**

1. Listar uma OS aberta e uma OS já finalizada. Comparar campo a campo — é isso que revela o
   que "finalizado" significa nessa base.
2. Criar uma OS de teste. Fechar **só ela** pela API.
3. **Listar de novo e conferir o registro inteiro** — nenhum campo pode ter sido apagado.
4. Só então liberar para lote, e ainda assim com a fila de aprovação da Fase 1.

---

## 8. Credenciais

O OpenBoard já tem acesso funcionando ao IXC. As variáveis (valores no `.env` local do
OpenBoard, arquivo **não commitado**):

| Variável | Conteúdo | Situação |
|---|---|---|
| `IXC_BASE_URL` | `https://{dominio}` — o `/webservice/v1` o cliente monta | preenchida |
| `IXC_TOKEN` | string completa, **já com o prefixo `Basic `** | preenchida |
| `IXC_PROXY_URL` | proxy externo | **vazia** — hoje vai direto na API |
| `IXC_FILIAIS` | `1,2,6` | preenchida |

O `.env.example` do OpenBoard documenta todas com comentário.

### Recomendação: NÃO reutilizar o token do OpenBoard

Dá para reutilizar, mas crie um **usuário/token próprio para o robô de OS**:

1. **Permissão** — o token atual foi criado para *ler* dados comerciais. Pode simplesmente
   não ter direito de editar OS, e o 401 vai parecer bug de código.
2. **Auditoria** — a OS finalizada fica registrada no IXC como fechada por aquele usuário.
   Com token compartilhado, o histórico mistura "sistema que só lê" com "robô que fecha OS".
3. **Revogação** — se o robô der problema, mata-se o token dele sem derrubar o sync
   comercial do OpenBoard.

### Segurança

O token é credencial de operação com poder de escrita no ERP. Copiar o valor **direto do
`.env` para o `.env` do outro sistema** — nunca por chat, print, commit ou anexo. Este
documento cita apenas os **nomes** das variáveis, de propósito.

---

## 9. Ordem sugerida de trabalho

1. Listar as OS abertas com assunto 223 / setor 64 / filial 6 e conferir o volume real.
2. Cruzar com o de-para de APs. Medir a taxa de casamento — quantas OS acham AP e quantas
   ficam órfãs. Se muitas ficarem órfãs, o de-para precisa de faxina antes de qualquer
   automação.
3. Implementar a medição de uso por **janela** (§5.1), não por snapshot.
4. Montar a tela/relatório read-only com os três estados. Rodar alguns dias **sem escrever
   nada** e conferir na mão se as classificações batem.
5. Só então: fila com aprovação (Fase 1).
6. Investigar o gerador de OS do IXC (§5.2) antes de considerar a Fase 2.

---

## 10. Regras

- Responder e documentar em **PT-BR**.
- Nunca commitar segredo.
- Sem dado inventado — só o que vier da API do IXC e do Omada.
