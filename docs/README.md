# Documentação do OpenBoard

Índice do que existe aqui. Docs de integração são **fonte de verdade das armadilhas** —
ler antes de mexer no código correspondente.

## Integrações

| Arquivo | Conteúdo |
|---|---|
| `IXC_INTEGRATION_HANDOFF.md` | API IXCSoft: auth, `qtype`/`query`/`oper`, paginação, MRR limpo, status de contrato, códigos de erro. **Só leitura** — escrita não está mapeada. Implementação: `src/lib/ixc.ts`. |
| `glpi-api-v2-integracao.md` | GLPI 11 API V2.1 (OAuth2) — a que o app usa. Espelho read-only dos chamados. Implementação: `src/lib/glpi.ts`. |
| `glpi-api-v1-referencia.md` | GLPI API v1 — necessária para o que a V2.1 não faz: gravar `status`, categoria, upload de anexo. Implementação: `src/lib/glpi-v1.ts`. |

## Handoffs (contexto para outra IA / outro sistema)

| Arquivo | Conteúdo |
|---|---|
| `HANDOFF_NOVA_IA.md` | Onboarding geral do projeto. |
| `HANDOFF-instagram-nova-conta.md` | Passo a passo para vincular uma nova conta do Instagram ao app da Meta. |
| `HANDOFF-instagram-verificacao.md` | Diagnóstico da coleta do Instagram (LIVE × SALVO). |
| `HANDOFF-os-hotspot-omada.md` | Fechar OS de "Hotspot sem uso" cruzando IXC × Omada. Roda no sistema de APs, não aqui. |
| `SALESTRACKER_FEATURES_HANDOFF.md` | Features do sistema antigo (salestracker) a serem cobertas antes do desligamento. |

## Produto / planejamento

| Arquivo | Conteúdo |
|---|---|
| `ROADMAP-comercial.md` | Roadmap do módulo Comercial. |
| `COMERCIAL_INTEGRATION_IDEAS.md` | Cross-links OpenBoard ↔ Comercial. |
| `prompt-encurtador-qr-analytics.md` | Briefing original do encurtador de links + QR + analytics. |

---

Fora daqui: `AGENTS.md` e `CLAUDE.md` ficam na raiz (convenção de ferramenta),
`README.md` da raiz é o do projeto, e `local/` guarda material de apoio não versionado
(prints, PDFs, briefings soltos).
