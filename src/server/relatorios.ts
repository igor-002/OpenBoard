// Relatório de produtividade por período — camada de dados compartilhada entre
// a página /reports (web) e o PDF (/api/relatorios/produtividade).
// Semântica do período: "criadas" = createdAt dentro; "concluídas" = doneAt dentro.
import "server-only";
import { db } from "@/lib/db";
import type { Priority, TaskColumn, TaskOrigin, AvatarUser } from "@/lib/types";

export type PeriodoDia = { iso: string; label: string; criadas: number; concluidas: number };

export type MembroProd = {
  id: string;
  name: string;
  initials: string;
  color: string;
  jobTitle: string;
  criadas: number; // atribuídas a ele, criadas no período
  concluidas: number;
  abertasAtuais: number; // snapshot agora
  tempoMedioMin: number | null; // média startedAt→doneAt das concluídas no período
  estimadoMin: number; // soma estimativas das concluídas c/ estimativa
  realMin: number; // soma real das mesmas
  noPrazoPct: number | null;
  horasApontadas: number; // TimeLog no período
};

export type TipoProd = {
  id: string;
  name: string;
  criadas: number;
  concluidas: number;
  tempoMedioMin: number | null;
  estimadoMedioMin: number | null;
};

export type ClienteProd = { id: string; razao: string; ixcId: string | null; total: number; concluidas: number };

export type ProjetoProd = { id: string; name: string; criadas: number; concluidas: number };

export type ConcluidaDetalhe = {
  id: string;
  title: string;
  assigneeName: string | null;
  tipoName: string | null;
  clienteRazao: string | null;
  projectName: string | null;
  origem: TaskOrigin;
  priority: Priority;
  createdAt: Date;
  startedAt: Date | null;
  doneAt: Date;
  estimatedMinutes: number | null;
  realMinutes: number | null;
  report: string | null;
  updates: number; // nº de atualizações na timeline
};

export type ProlongadaItem = {
  id: string;
  title: string;
  assigneeName: string | null;
  tipoName: string | null;
  projectName: string | null;
  column: TaskColumn;
  createdAt: Date;
  startedAt: Date | null;
  diasAberta: number;
  estimatedMinutes: number | null;
};

export type ProdutividadeReport = {
  from: Date;
  to: Date;
  geradoEm: Date;
  workspaceName: string;
  kpis: {
    criadas: number;
    concluidas: number;
    abertasAtuais: number; // snapshot
    vencidasAtuais: number; // snapshot
    tempoMedioExecMin: number | null; // startedAt→doneAt
    leadTimeMedioDias: number | null; // createdAt→doneAt
    noPrazoPct: number | null;
    estimadoTotalMin: number; // concluídas com est+real
    realTotalMin: number;
    horasApontadas: number; // TimeLog do período
  };
  porDia: PeriodoDia[];
  porOrigem: { origem: TaskOrigin; criadas: number; concluidas: number }[];
  porMembro: MembroProd[];
  porTipo: TipoProd[];
  porCliente: ClienteProd[];
  porProjeto: ProjetoProd[];
  concluidas: ConcluidaDetalhe[];
  prolongadas: ProlongadaItem[];
};

const DAY = 86400000;
const ORIGENS: TaskOrigin[] = ["planejada", "avulsa", "presencial"];

const execMin = (t: { startedAt: Date | null; doneAt: Date | null }) =>
  t.startedAt && t.doneAt ? Math.max(0, Math.round((+t.doneAt - +t.startedAt) / 60000)) : null;

function media(nums: number[]): number | null {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
}

export async function getProdutividadeReport(workspaceId: string, from: Date, to: Date): Promise<ProdutividadeReport> {
  const now = new Date();

  const [ws, criadasRaw, concluidasRaw, abertasRaw, users, logs] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    // Criadas no período (qualquer status hoje).
    db.task.findMany({
      where: { workspaceId, createdAt: { gte: from, lte: to } },
      select: {
        id: true, createdAt: true, origem: true, assigneeId: true, tipoId: true,
        ixcClienteId: true, projectId: true,
      },
    }),
    // Concluídas no período (detalhe completo — alimenta tabelas e o PDF).
    db.task.findMany({
      where: { workspaceId, column: "done", doneAt: { gte: from, lte: to } },
      orderBy: { doneAt: "desc" },
      select: {
        id: true, title: true, origem: true, priority: true, createdAt: true, startedAt: true,
        doneAt: true, dueDate: true, estimatedMinutes: true, report: true,
        assigneeId: true, assignee: { select: { name: true } },
        tipoId: true, tipo: { select: { name: true } },
        ixcClienteId: true, ixcCliente: { select: { id: true, razao: true, ixcId: true } },
        projectId: true, project: { select: { name: true } },
        _count: { select: { comments: true } },
      },
    }),
    // Abertas agora (snapshot — prolongadas, vencidas, carga atual).
    db.task.findMany({
      where: { workspaceId, column: { not: "done" } },
      select: {
        id: true, title: true, column: true, createdAt: true, startedAt: true, dueDate: true,
        estimatedMinutes: true, assigneeId: true, assignee: { select: { name: true } },
        tipo: { select: { name: true } }, project: { select: { name: true } },
      },
    }),
    db.user.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, initials: true, color: true, jobTitle: true },
    }),
    db.timeLog.findMany({
      where: { project: { workspaceId }, startedAt: { gte: from, lte: to } },
      select: { userId: true, durationSec: true },
    }),
  ]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const execs = concluidasRaw.map(execMin).filter((m): m is number => m != null);
  const leads = concluidasRaw
    .map((t) => (t.doneAt ? (+t.doneAt - +t.createdAt) / DAY : null))
    .filter((d): d is number => d != null && d >= 0);
  const comPrazo = concluidasRaw.filter((t) => t.dueDate);
  const comEstEReal = concluidasRaw.filter((t) => t.estimatedMinutes != null && execMin(t) != null);
  const vencidasAtuais = abertasRaw.filter((t) => t.dueDate && t.dueDate < now).length;
  const horasTotais = logs.reduce((s, l) => s + l.durationSec, 0) / 3600;

  const kpis = {
    criadas: criadasRaw.length,
    concluidas: concluidasRaw.length,
    abertasAtuais: abertasRaw.length,
    vencidasAtuais,
    tempoMedioExecMin: media(execs),
    leadTimeMedioDias: leads.length ? Math.round((leads.reduce((a, b) => a + b, 0) / leads.length) * 10) / 10 : null,
    noPrazoPct: comPrazo.length
      ? Math.round((comPrazo.filter((t) => +t.doneAt! <= +t.dueDate! + DAY).length / comPrazo.length) * 100)
      : null,
    estimadoTotalMin: comEstEReal.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0),
    realTotalMin: comEstEReal.reduce((s, t) => s + (execMin(t) ?? 0), 0),
    horasApontadas: Math.round(horasTotais * 10) / 10,
  };

  // ── Série diária ──────────────────────────────────────────────────────────
  const porDia: PeriodoDia[] = [];
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const criadasPorDia = new Map<string, number>();
  for (const t of criadasRaw) {
    const k = dayKey(t.createdAt);
    criadasPorDia.set(k, (criadasPorDia.get(k) ?? 0) + 1);
  }
  const concluidasPorDia = new Map<string, number>();
  for (const t of concluidasRaw) {
    const k = dayKey(t.doneAt!);
    concluidasPorDia.set(k, (concluidasPorDia.get(k) ?? 0) + 1);
  }
  // Períodos acima de ~1 mês agrupam por semana pra não virar poeira.
  const spanDias = Math.max(1, Math.round((+to - +from) / DAY));
  const porSemana = spanDias > 31;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= to) {
    const chunkEnd = porSemana ? new Date(Math.min(+cursor + 6 * DAY, +to)) : cursor;
    let cri = 0;
    let con = 0;
    const it = new Date(cursor);
    while (it <= chunkEnd) {
      const k = dayKey(it);
      cri += criadasPorDia.get(k) ?? 0;
      con += concluidasPorDia.get(k) ?? 0;
      it.setDate(it.getDate() + 1);
    }
    porDia.push({
      iso: dayKey(cursor),
      label: porSemana
        ? `${cursor.getDate()}/${cursor.getMonth() + 1}–${chunkEnd.getDate()}/${chunkEnd.getMonth() + 1}`
        : cursor.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      criadas: cri,
      concluidas: con,
    });
    cursor.setDate(cursor.getDate() + (porSemana ? 7 : 1));
  }

  // ── Por origem ────────────────────────────────────────────────────────────
  const porOrigem = ORIGENS.map((origem) => ({
    origem,
    criadas: criadasRaw.filter((t) => t.origem === origem).length,
    concluidas: concluidasRaw.filter((t) => t.origem === origem).length,
  }));

  // ── Por membro ────────────────────────────────────────────────────────────
  const horasPorUser = new Map<string, number>();
  for (const l of logs) horasPorUser.set(l.userId, (horasPorUser.get(l.userId) ?? 0) + l.durationSec / 3600);

  const porMembro: MembroProd[] = users
    .map((u) => {
      const concl = concluidasRaw.filter((t) => t.assigneeId === u.id);
      const execsM = concl.map(execMin).filter((m): m is number => m != null);
      const comPrazoM = concl.filter((t) => t.dueDate);
      const estReal = concl.filter((t) => t.estimatedMinutes != null && execMin(t) != null);
      return {
        id: u.id,
        name: u.name,
        initials: u.initials,
        color: u.color,
        jobTitle: u.jobTitle,
        criadas: criadasRaw.filter((t) => t.assigneeId === u.id).length,
        concluidas: concl.length,
        abertasAtuais: abertasRaw.filter((t) => t.assigneeId === u.id).length,
        tempoMedioMin: media(execsM),
        estimadoMin: estReal.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0),
        realMin: estReal.reduce((s, t) => s + (execMin(t) ?? 0), 0),
        noPrazoPct: comPrazoM.length
          ? Math.round((comPrazoM.filter((t) => +t.doneAt! <= +t.dueDate! + DAY).length / comPrazoM.length) * 100)
          : null,
        horasApontadas: Math.round((horasPorUser.get(u.id) ?? 0) * 10) / 10,
      };
    })
    .filter((m) => m.criadas > 0 || m.concluidas > 0 || m.abertasAtuais > 0 || m.horasApontadas > 0)
    .sort((a, b) => b.concluidas - a.concluidas || b.criadas - a.criadas);

  // ── Por tipo ──────────────────────────────────────────────────────────────
  const tipos = await db.taskType.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } });
  const porTipo: TipoProd[] = tipos
    .map((tp) => {
      const concl = concluidasRaw.filter((t) => t.tipoId === tp.id);
      const execsT = concl.map(execMin).filter((m): m is number => m != null);
      const ests = concl.map((t) => t.estimatedMinutes).filter((e): e is number => e != null);
      return {
        id: tp.id,
        name: tp.name,
        criadas: criadasRaw.filter((t) => t.tipoId === tp.id).length,
        concluidas: concl.length,
        tempoMedioMin: media(execsT),
        estimadoMedioMin: media(ests),
      };
    })
    .filter((t) => t.criadas > 0 || t.concluidas > 0)
    .sort((a, b) => b.criadas + b.concluidas - (a.criadas + a.concluidas));
  // Tarefas sem tipo (kanban antigo) entram como "Sem tipo".
  const semTipoCriadas = criadasRaw.filter((t) => !t.tipoId).length;
  const semTipoConcl = concluidasRaw.filter((t) => !t.tipoId);
  if (semTipoCriadas > 0 || semTipoConcl.length > 0) {
    porTipo.push({
      id: "sem-tipo",
      name: "Sem tipo",
      criadas: semTipoCriadas,
      concluidas: semTipoConcl.length,
      tempoMedioMin: media(semTipoConcl.map(execMin).filter((m): m is number => m != null)),
      estimadoMedioMin: null,
    });
  }

  // ── Por cliente (top 12 por volume no período) ────────────────────────────
  const cliMap = new Map<string, ClienteProd>();
  for (const t of concluidasRaw) {
    if (!t.ixcCliente) continue;
    const cur = cliMap.get(t.ixcCliente.id) ?? { id: t.ixcCliente.id, razao: t.ixcCliente.razao, ixcId: t.ixcCliente.ixcId, total: 0, concluidas: 0 };
    cur.total += 1;
    cur.concluidas += 1;
    cliMap.set(t.ixcCliente.id, cur);
  }
  // criadas-no-período ainda abertas também contam volume por cliente
  const criadasComCliente = await db.task.findMany({
    where: { workspaceId, createdAt: { gte: from, lte: to }, ixcClienteId: { not: null }, NOT: { column: "done", doneAt: { gte: from, lte: to } } },
    select: { ixcCliente: { select: { id: true, razao: true, ixcId: true } } },
  });
  for (const t of criadasComCliente) {
    if (!t.ixcCliente) continue;
    const cur = cliMap.get(t.ixcCliente.id) ?? { id: t.ixcCliente.id, razao: t.ixcCliente.razao, ixcId: t.ixcCliente.ixcId, total: 0, concluidas: 0 };
    cur.total += 1;
    cliMap.set(t.ixcCliente.id, cur);
  }
  const porCliente = [...cliMap.values()].sort((a, b) => b.total - a.total).slice(0, 12);

  // ── Por projeto ───────────────────────────────────────────────────────────
  const projMap = new Map<string, ProjetoProd>();
  const addProj = (id: string | null, name: string | null, campo: "criadas" | "concluidas") => {
    const key = id ?? "avulsa";
    const cur = projMap.get(key) ?? { id: key, name: name ?? "Avulsas (sem projeto)", criadas: 0, concluidas: 0 };
    cur[campo] += 1;
    projMap.set(key, cur);
  };
  const criadasProj = await db.task.findMany({
    where: { workspaceId, createdAt: { gte: from, lte: to } },
    select: { projectId: true, project: { select: { name: true } } },
  });
  for (const t of criadasProj) addProj(t.projectId, t.project?.name ?? null, "criadas");
  for (const t of concluidasRaw) addProj(t.projectId, t.project?.name ?? null, "concluidas");
  const porProjeto = [...projMap.values()].sort((a, b) => b.criadas + b.concluidas - (a.criadas + a.concluidas));

  // ── Concluídas detalhadas ─────────────────────────────────────────────────
  const concluidas: ConcluidaDetalhe[] = concluidasRaw.map((t) => ({
    id: t.id,
    title: t.title,
    assigneeName: t.assignee?.name ?? null,
    tipoName: t.tipo?.name ?? null,
    clienteRazao: t.ixcCliente?.razao ?? null,
    projectName: t.project?.name ?? null,
    origem: t.origem,
    priority: t.priority,
    createdAt: t.createdAt,
    startedAt: t.startedAt,
    doneAt: t.doneAt!,
    estimatedMinutes: t.estimatedMinutes,
    realMinutes: execMin(t),
    report: t.report,
    updates: t._count.comments,
  }));

  // ── Prolongadas: abertas há mais tempo (top 15) ───────────────────────────
  const prolongadas: ProlongadaItem[] = abertasRaw
    .map((t) => ({
      id: t.id,
      title: t.title,
      assigneeName: t.assignee?.name ?? null,
      tipoName: t.tipo?.name ?? null,
      projectName: t.project?.name ?? null,
      column: t.column,
      createdAt: t.createdAt,
      startedAt: t.startedAt,
      diasAberta: Math.floor((+now - +t.createdAt) / DAY),
      estimatedMinutes: t.estimatedMinutes,
    }))
    .sort((a, b) => b.diasAberta - a.diasAberta)
    .slice(0, 15);

  return {
    from,
    to,
    geradoEm: now,
    workspaceName: ws?.name ?? "",
    kpis,
    porDia,
    porOrigem,
    porMembro,
    porTipo,
    porCliente,
    porProjeto,
    concluidas,
    prolongadas,
  };
}

// ── Resumo simples (estilo "resumo-projetos-semana": projeto → pessoa → status) ──

export type ResumoItem = {
  title: string;
  tipoName: string | null;
  clienteRazao: string | null;
  origem: TaskOrigin;
  report: string | null;
  realMinutes: number | null;
  estimatedMinutes: number | null;
  doneAt: Date | null;
  dueDate: Date | null;
  ultimaAtualizacao: string | null; // última entrada da timeline (contexto do andamento)
};

export type ResumoPessoa = {
  name: string;
  concluidas: ResumoItem[]; // doneAt dentro do período
  andamento: ResumoItem[]; // doing/review agora
  fila: ResumoItem[]; // todo agora
};

export type ResumoProjeto = { name: string; pessoas: ResumoPessoa[] };

export type ResumoSemana = {
  from: Date;
  to: Date;
  geradoEm: Date;
  workspaceName: string;
  destaques: { projeto: string; itens: string[] }[]; // página 1: entregas por projeto
  projetos: ResumoProjeto[];
};

export async function getResumoSemana(workspaceId: string, from: Date, to: Date): Promise<ResumoSemana> {
  const [ws, tasks] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    db.task.findMany({
      where: {
        workspaceId,
        OR: [{ column: { not: "done" } }, { doneAt: { gte: from, lte: to } }],
      },
      orderBy: [{ column: "asc" }, { doneAt: "desc" }, { createdAt: "asc" }],
      select: {
        title: true, column: true, origem: true, doneAt: true, dueDate: true,
        startedAt: true, estimatedMinutes: true, report: true,
        assignee: { select: { name: true } },
        tipo: { select: { name: true } },
        ixcCliente: { select: { razao: true } },
        project: { select: { name: true } },
        comments: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
      },
    }),
  ]);

  const toItem = (t: (typeof tasks)[number]): ResumoItem => ({
    title: t.title,
    tipoName: t.tipo?.name ?? null,
    clienteRazao: t.ixcCliente?.razao ?? null,
    origem: t.origem,
    report: t.report,
    realMinutes: execMin(t),
    estimatedMinutes: t.estimatedMinutes,
    doneAt: t.doneAt,
    dueDate: t.dueDate,
    ultimaAtualizacao: t.comments[0]?.body ?? null,
  });

  // projeto → pessoa → buckets (avulsas viram o "projeto" Atividades avulsas)
  const projMap = new Map<string, Map<string, ResumoPessoa>>();
  for (const t of tasks) {
    const projName = t.project?.name ?? "Atividades avulsas";
    const pessoaName = t.assignee?.name ?? "Sem responsável";
    if (!projMap.has(projName)) projMap.set(projName, new Map());
    const pessoas = projMap.get(projName)!;
    if (!pessoas.has(pessoaName)) pessoas.set(pessoaName, { name: pessoaName, concluidas: [], andamento: [], fila: [] });
    const p = pessoas.get(pessoaName)!;
    if (t.column === "done") p.concluidas.push(toItem(t));
    else if (t.column === "todo") p.fila.push(toItem(t));
    else p.andamento.push(toItem(t));
  }

  const projetos: ResumoProjeto[] = [...projMap.entries()]
    .map(([name, pessoas]) => ({
      name,
      pessoas: [...pessoas.values()]
        .filter((p) => p.concluidas.length || p.andamento.length || p.fila.length)
        .sort((a, b) => b.concluidas.length - a.concluidas.length),
    }))
    .filter((p) => p.pessoas.length > 0)
    // projetos com entregas primeiro; "Atividades avulsas" no topo se tiver volume
    .sort((a, b) => {
      const done = (x: ResumoProjeto) => x.pessoas.reduce((s, p) => s + p.concluidas.length, 0);
      return done(b) - done(a);
    });

  const destaques = projetos
    .map((p) => ({
      projeto: p.name,
      // título único (dedup) — várias execuções da mesma demanda viram 1 destaque
      itens: [...new Set(p.pessoas.flatMap((pe) => pe.concluidas.map((c) => c.title)))].slice(0, 10),
    }))
    .filter((d) => d.itens.length > 0);

  return { from, to, geradoEm: new Date(), workspaceName: ws?.name ?? "", destaques, projetos };
}

// ── Helpers de período (querystring → datas) — usados pela página e pela rota PDF.
export type PeriodoPreset = "semana" | "7d" | "mes" | "30d" | "trimestre";

export function resolvePeriodo(sp: { preset?: string; from?: string; to?: string }): { from: Date; to: Date; preset: PeriodoPreset | "custom" } {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) {
    const from = new Date(sp.from + "T00:00:00");
    const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? new Date(sp.to + "T23:59:59.999") : endOfToday;
    if (!isNaN(+from) && !isNaN(+to) && from <= to) return { from, to, preset: "custom" };
  }

  switch (sp.preset) {
    case "7d":
      return { from: day(new Date(+now - 6 * DAY)), to: endOfToday, preset: "7d" };
    case "mes":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfToday, preset: "mes" };
    case "30d":
      return { from: day(new Date(+now - 29 * DAY)), to: endOfToday, preset: "30d" };
    case "trimestre":
      return { from: day(new Date(+now - 89 * DAY)), to: endOfToday, preset: "trimestre" };
    case "semana":
    default: {
      // Semana corrente (segunda → hoje).
      const dow = (now.getDay() + 6) % 7; // 0 = segunda
      return { from: day(new Date(+now - dow * DAY)), to: endOfToday, preset: "semana" };
    }
  }
}
