// IA das Notas. Reusa a MESMA config da análise de leads (getOpenAIConfig →
// AppSetting/env, tela Comercial → Config IA). Nada de chave/modelo próprios.
import "server-only";
import { db } from "@/lib/db";
import { getOpenAIConfig } from "@/server/settings";
import { chatJson, chatText, custoUsdMicros, openaiConfigured, OpenAIError, type ChatMessage } from "@/lib/openai";
import { noteAccess, podeVer, podeEditar, type NoteAccess } from "@/server/notas";

export const IA_NAO_CONFIGURADA = "IA não configurada — peça ao admin para preencher a chave da OpenAI em Comercial → Config IA.";

// Corta a nota pra não estourar contexto (nem custo) numa nota gigante.
const MAX_CTX = 12000;

function contexto(title: string, body: string): string {
  const md = body.length > MAX_CTX ? `${body.slice(0, MAX_CTX)}\n\n[…nota truncada…]` : body;
  return `TÍTULO: ${title || "(sem título)"}\n\nCONTEÚDO (markdown):\n${md}`;
}

const SYSTEM_BASE =
  "Você é um assistente que trabalha em cima das anotações de trabalho de uma pessoa, em português do Brasil. " +
  "Responda apenas com base no que está na nota; se a nota não disser algo, diga que não está na nota em vez de inventar. " +
  "Seja direto e sem preâmbulo.";

type NotaCarregada = NonNullable<Awaited<ReturnType<typeof noteAccess>>["note"]>;
type Carga = { ok: false; error: string } | { ok: true; note: NotaCarregada; access: NoteAccess };

async function carregar(userId: string, noteId: string): Promise<Carga> {
  const { note, access } = await noteAccess(userId, noteId);
  if (!note || !podeVer(access)) return { ok: false, error: "Nota não encontrada." };
  if (note.body.trim().length < 40) return { ok: false, error: "A nota é curta demais para a IA trabalhar." };
  return { ok: true, note, access };
}

function msgErro(e: unknown): string {
  if (e instanceof OpenAIError) return `Falha na OpenAI: ${e.message}`;
  return (e as Error).message || "Falha ao chamar a IA.";
}

// ── Resumir ────────────────────────────────────────────────────────────────
// Único que PERSISTE (campos ai* da Note), espelhando o padrão de Lead.analise*.
export async function resumirNota(
  userId: string,
  noteId: string,
): Promise<{ ok: true; resumo: string } | { ok: false; error: string }> {
  const cfg = await getOpenAIConfig();
  if (!openaiConfigured(cfg)) return { ok: false, error: IA_NAO_CONFIGURADA };

  const r = await carregar(userId, noteId);
  if (!r.ok) return r;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_BASE} Resuma a anotação em no máximo 5 tópicos curtos, começando cada um com "- ". Se houver decisões, prazos ou pendências, eles vêm primeiro. Sem título, sem introdução.`,
    },
    { role: "user", content: contexto(r.note.title, r.note.body) },
  ];

  try {
    const res = await chatText(cfg, messages, { maxTokens: 500 });
    const resumo = res.content.trim();
    if (!resumo) return { ok: false, error: "A IA devolveu vazio." };
    // Gravar o resumo ALTERA a nota — quem só tem leitura vê o resultado na
    // tela mas não escreve na nota de outra pessoa.
    if (podeEditar(r.access)) {
      await db.note.update({
        where: { id: noteId },
        data: {
          aiResumo: resumo,
          aiModelo: cfg.model,
          aiTokensIn: res.usage.promptTokens,
          aiTokensOut: res.usage.completionTokens,
          aiCustoUsdMicros: custoUsdMicros(cfg, res.usage),
          aiAt: new Date(),
        },
      });
    }
    return { ok: true, resumo };
  } catch (e) {
    return { ok: false, error: msgErro(e) };
  }
}

// ── Perguntar ──────────────────────────────────────────────────────────────
// Não persiste: a resposta vive no painel enquanto a pessoa estiver na nota.
export async function perguntarSobreNota(
  userId: string,
  noteId: string,
  pergunta: string,
): Promise<{ ok: true; resposta: string } | { ok: false; error: string }> {
  const cfg = await getOpenAIConfig();
  if (!openaiConfigured(cfg)) return { ok: false, error: IA_NAO_CONFIGURADA };

  const p = pergunta.trim();
  if (!p) return { ok: false, error: "Escreva a pergunta." };
  if (p.length > 1000) return { ok: false, error: "Pergunta muito longa." };

  const r = await carregar(userId, noteId);
  if (!r.ok) return r;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_BASE },
    { role: "user", content: `${contexto(r.note.title, r.note.body)}\n\nPERGUNTA: ${p}` },
  ];

  try {
    const res = await chatText(cfg, messages, { maxTokens: 800 });
    const resposta = res.content.trim();
    if (!resposta) return { ok: false, error: "A IA devolveu vazio." };
    return { ok: true, resposta };
  } catch (e) {
    return { ok: false, error: msgErro(e) };
  }
}

// ── Extrair tarefas ────────────────────────────────────────────────────────
// Devolve SUGESTÕES. Quem cria Task de verdade é a action, depois de a pessoa
// escolher — IA criando tarefa sozinha vira poluição de kanban.
export type TarefaSugerida = { titulo: string; prazo: string | null };

export async function extrairTarefas(
  userId: string,
  noteId: string,
): Promise<{ ok: true; tarefas: TarefaSugerida[] } | { ok: false; error: string }> {
  const cfg = await getOpenAIConfig();
  if (!openaiConfigured(cfg)) return { ok: false, error: IA_NAO_CONFIGURADA };

  const r = await carregar(userId, noteId);
  if (!r.ok) return r;

  const hoje = new Date().toISOString().slice(0, 10);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `${SYSTEM_BASE} Extraia da anotação as AÇÕES pendentes (o que ainda precisa ser feito). Ignore o que já está concluído e o que é só contexto. ` +
        `Hoje é ${hoje}; converta prazos relativos ("amanhã", "sexta") para data ISO AAAA-MM-DD, e use null quando não houver prazo. ` +
        `Responda SOMENTE com JSON válido: {"tarefas":[{"titulo":"<verbo no infinitivo, curto>","prazo":"AAAA-MM-DD"|null}]}. ` +
        `No máximo 10 tarefas. Se não houver nenhuma, devolva {"tarefas":[]}.`,
    },
    { role: "user", content: contexto(r.note.title, r.note.body) },
  ];

  try {
    const res = await chatJson(cfg, messages, { maxTokens: 700 });
    let bruto: unknown;
    try {
      bruto = JSON.parse(res.content);
    } catch {
      return { ok: false, error: "A IA devolveu um JSON inválido." };
    }
    const lista = (bruto as { tarefas?: unknown })?.tarefas;
    if (!Array.isArray(lista)) return { ok: false, error: "A IA devolveu um formato inesperado." };

    const tarefas: TarefaSugerida[] = [];
    for (const item of lista.slice(0, 10)) {
      const titulo = typeof (item as { titulo?: unknown })?.titulo === "string" ? (item as { titulo: string }).titulo.trim() : "";
      if (!titulo) continue;
      const prazoBruto = (item as { prazo?: unknown })?.prazo;
      const prazo = typeof prazoBruto === "string" && /^\d{4}-\d{2}-\d{2}$/.test(prazoBruto) ? prazoBruto : null;
      tarefas.push({ titulo: titulo.slice(0, 160), prazo });
    }
    return { ok: true, tarefas };
  } catch (e) {
    return { ok: false, error: msgErro(e) };
  }
}
