// Backend de Solicitações de Cadastro de clientes. Server-only.
// Criação vem do form PÚBLICO /solicitar-cadastro (action já validada com zod +
// rate-limit); fila interna em /comercial/cadastros. Ver src/lib/cadastros.ts.
import "server-only";
import { db } from "@/lib/db";
import { normDoc, normPhone, normEmail } from "@/lib/leads";
import { compareSolicitacoes, isSolicitacaoStatus, type SolicitacaoStatus } from "@/lib/cadastros";
import { emitAppEvent } from "@/server/events";
import { notify } from "@/server/notifications";
import { getSetting, SETTING_KEYS } from "@/server/settings";
import type { SolicitacaoCadastro } from "@/generated/prisma";

export type SolicitacaoInput = {
  solicitante: string;
  nomeCompleto: string;
  cnpjCpf: string;
  rg?: string | null;
  inscricaoEstadual?: string | null;
  cidade?: string | null;
  bairro?: string | null;
  rua?: string | null;
  pontoReferencia?: string | null;
  cep?: string | null;
  telefone1: string;
  telefone2?: string | null;
  emailBoletos?: string | null;
  vencimentoDia?: number | null;
  plano?: string | null;
  valorCents?: number;
  observacao?: string | null;
  situacao: "normal" | "urgente";
  prazoAt?: Date | null;
};

// Destinatários das notificações de solicitação nova. Configurável em
// /comercial/config (JSON de User.id). Fallback: todos os admins — a
// notificação nunca some silenciosamente por falta de config.
export async function getCadastroNotifyUserIds(): Promise<string[]> {
  const raw = await getSetting(SETTING_KEYS.cadastroNotifyUserIds);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const ids = parsed.filter((x): x is string => typeof x === "string" && !!x);
        if (ids.length) return ids;
      }
    } catch {
      /* JSON inválido → cai no fallback */
    }
  }
  const admins = await db.user.findMany({ where: { role: "admin" }, select: { id: true } });
  return admins.map((a) => a.id);
}

// Cria a solicitação + evento de entrada e dispara toast (SSE) e sino
// (notificação persistente) pros destinatários configurados.
export async function createSolicitacao(input: SolicitacaoInput): Promise<{ id: string }> {
  const s = await db.solicitacaoCadastro.create({
    data: {
      solicitante: input.solicitante.trim(),
      nomeCompleto: input.nomeCompleto.trim(),
      cnpjCpf: input.cnpjCpf.trim(),
      cnpjCpfNorm: normDoc(input.cnpjCpf),
      rg: input.rg?.trim() || null,
      inscricaoEstadual: input.inscricaoEstadual?.trim() || null,
      cidade: input.cidade?.trim() || null,
      bairro: input.bairro?.trim() || null,
      rua: input.rua?.trim() || null,
      pontoReferencia: input.pontoReferencia?.trim() || null,
      cep: input.cep?.trim() || null,
      telefone1: input.telefone1.trim(),
      telefone1Norm: normPhone(input.telefone1),
      telefone2: input.telefone2?.trim() || null,
      telefone2Norm: normPhone(input.telefone2),
      emailBoletos: normEmail(input.emailBoletos),
      vencimentoDia: input.vencimentoDia ?? null,
      plano: input.plano?.trim() || null,
      valorCents: Math.max(0, Math.round(input.valorCents ?? 0)),
      observacao: input.observacao?.trim() || null,
      situacao: input.situacao,
      prazoAt: input.prazoAt ?? null,
    },
  });
  await db.solicitacaoCadastroEvent.create({
    data: { solicitacaoId: s.id, fromStatus: null, toStatus: "pendente" },
  });

  // Notificações fora do caminho crítico do insert — falha não derruba o form.
  try {
    const recipientIds = await getCadastroNotifyUserIds();
    if (recipientIds.length) {
      await notify(recipientIds, {
        type: "solicitacao_cadastro",
        title: "Nova solicitação de cadastro",
        body: `${s.nomeCompleto} — por ${s.solicitante}`,
        link: "/comercial/cadastros",
      });
      emitAppEvent({
        kind: "solicitacao_cadastro",
        recipientIds,
        actorName: s.solicitante,
        entity: s.nomeCompleto,
        link: "/comercial/cadastros",
      });
    }
  } catch (err) {
    console.error("[cadastros] falha ao notificar solicitação nova:", err);
  }
  return { id: s.id };
}

// Fila ordenada por prioridade efetiva (urgente > prazo próximo > mais antigo).
// Sort em JS: urgência efetiva é derivada (situacao OU prazo ≤2 dias), não dá
// pra expressar 100% no SQL — volume é baixo (fila operacional).
export async function listSolicitacoes(status: SolicitacaoStatus): Promise<SolicitacaoCadastro[]> {
  const rows = await db.solicitacaoCadastro.findMany({
    where: { status },
    orderBy: { createdAt: "asc" },
  });
  return rows.sort((a, b) => compareSolicitacoes(a, b));
}

export async function countSolicitacoesPorStatus(): Promise<Record<string, number>> {
  const grouped = await db.solicitacaoCadastro.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
}

// Muda o status registrando histórico (única forma correta de mudar status).
export async function changeSolicitacaoStatus(
  id: string,
  toStatus: SolicitacaoStatus,
  movedByUserId: string,
): Promise<void> {
  if (!isSolicitacaoStatus(toStatus)) return;
  const atual = await db.solicitacaoCadastro.findUnique({ where: { id }, select: { status: true } });
  if (!atual || atual.status === toStatus) return;
  const finalizado = toStatus !== "pendente";
  await db.$transaction([
    db.solicitacaoCadastro.update({
      where: { id },
      data: {
        status: toStatus,
        statusChangedAt: new Date(),
        finalizadoAt: finalizado ? new Date() : null,
        finalizadoPorId: finalizado ? movedByUserId : null,
      },
    }),
    db.solicitacaoCadastroEvent.create({
      data: { solicitacaoId: id, fromStatus: atual.status, toStatus, movedByUserId },
    }),
  ]);
}
