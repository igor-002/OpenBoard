// Seed do OpenBoard — dados fictícios portados de data.jsx do protótipo.
// Roda com `npm run db:seed` (prisma db seed -> tsx prisma/seed.ts).
import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const YEAR = 2026;
const MONTHS: Record<string, number> = {
  Jan: 0, Fev: 1, Mar: 2, Abr: 3, Mai: 4, Jun: 5,
  Jul: 6, Ago: 7, Set: 8, Out: 9, Nov: 10, Dez: 11,
};
// "02 Mar" | "15 Jul 2026" -> Date
function d(label: string): Date {
  const [day, mon, year] = label.trim().split(/\s+/);
  return new Date(Number(year ?? YEAR), MONTHS[mon], Number(day));
}
// "3:42:10" -> segundos
function secs(dur: string): number {
  const [h, m, s] = dur.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}
// "09:02" -> Date hoje (2026-06-04)
function at(time: string): Date {
  const [h, m] = time.split(":").map(Number);
  return new Date(YEAR, 5, 4, h, m, 0);
}
const slug = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(" ")[0];

const TEAM = [
  { key: "u1", name: "Marina Alves", role: "Gerente de Projetos", initials: "MA", color: "#F2691F", roleEnum: "admin" as const },
  { key: "u2", name: "Rafael Costa", role: "Tech Lead", initials: "RC", color: "#2D6FF2", roleEnum: "admin" as const },
  { key: "u3", name: "Beatriz Lima", role: "Product Designer", initials: "BL", color: "#7A5AE0", roleEnum: "membro" as const },
  { key: "u4", name: "Diego Martins", role: "Dev Back-end", initials: "DM", color: "#16A34A", roleEnum: "membro" as const },
  { key: "u5", name: "Carla Souza", role: "Dev Front-end", initials: "CS", color: "#E8910C", roleEnum: "membro" as const },
  { key: "u6", name: "Felipe Rocha", role: "QA / Testes", initials: "FR", color: "#2DBE9E", roleEnum: "membro" as const },
  { key: "u7", name: "Juliana Pires", role: "Analista de Dados", initials: "JP", color: "#E5484D", roleEnum: "membro" as const },
  { key: "u8", name: "Lucas Fernandes", role: "Dev Mobile", initials: "LF", color: "#0EA5E9", roleEnum: "membro" as const },
  { key: "u9", name: "Renata Dias", role: "Scrum Master", initials: "RD", color: "#DB2777", roleEnum: "membro" as const },
  { key: "u10", name: "Bruno Teixeira", role: "DevOps", initials: "BT", color: "#65A30D", roleEnum: "membro" as const },
];

const PROJECTS = [
  { key: "p1", name: "App Mobile — Carteira Digital", client: "Banco Vërtex", tag: "Produto", status: "progress" as const, progress: 68, dueLabel: "15 Jul 2026", start: "02 Mar", budget: 42000000, spent: 62, members: ["u1", "u2", "u8", "u5"], risk: false },
  { key: "p2", name: "Portal do Cliente — Reformulação", client: "Eletrosul", tag: "Web", status: "progress" as const, progress: 45, dueLabel: "28 Ago 2026", start: "10 Abr", budget: 31000000, spent: 38, members: ["u3", "u5", "u6"], risk: true },
  { key: "p3", name: "Migração de Infra para Cloud", client: "Interno", tag: "Infra", status: "review" as const, progress: 88, dueLabel: "30 Jun 2026", start: "05 Jan", budget: 18000000, spent: 81, members: ["u10", "u4", "u2"], risk: false },
  { key: "p4", name: "Dashboard de BI — Vendas", client: "Mercato", tag: "Dados", status: "progress" as const, progress: 32, dueLabel: "12 Set 2026", start: "20 Mai", budget: 9500000, spent: 24, members: ["u7", "u3"], risk: false },
  { key: "p5", name: "Campanha de Onboarding", client: "Saúde+", tag: "Growth", status: "done" as const, progress: 100, dueLabel: "18 Mai 2026", start: "01 Fev", budget: 6000000, spent: 97, members: ["u9", "u3", "u1"], risk: false },
  { key: "p6", name: "API de Pagamentos v2", client: "PagaFácil", tag: "Back-end", status: "planned" as const, progress: 8, dueLabel: "05 Out 2026", start: "15 Jun", budget: 24000000, spent: 5, members: ["u4", "u2", "u10"], risk: false },
  { key: "p7", name: "Redesign do Design System", client: "Interno", tag: "Design", status: "review" as const, progress: 74, dueLabel: "22 Jul 2026", start: "08 Mar", budget: 7000000, spent: 66, members: ["u3", "u5"], risk: false },
  { key: "p8", name: "Integração ERP — Financeiro", client: "Construtora Apex", tag: "Integração", status: "progress" as const, progress: 53, dueLabel: "19 Ago 2026", start: "12 Abr", budget: 20000000, spent: 49, members: ["u4", "u6", "u7", "u2"], risk: true },
];

const TASKS = [
  { title: "Definir fluxo de autenticação biométrica", proj: "p1", col: "todo" as const, pr: "high" as const, due: "12 Jun", assignee: "u2", tags: ["Mobile", "Segurança"], subDone: 2, subTotal: 5, comments: 4 },
  { title: "Wireframes da tela de extrato", proj: "p1", col: "todo" as const, pr: "med" as const, due: "14 Jun", assignee: "u3", tags: ["Design"], subDone: 0, subTotal: 3, comments: 1 },
  { title: "Modelar tabelas de transações", proj: "p1", col: "doing" as const, pr: "high" as const, due: "10 Jun", assignee: "u4", tags: ["Back-end"], subDone: 4, subTotal: 6, comments: 7 },
  { title: "Componente de gráfico de gastos", proj: "p4", col: "doing" as const, pr: "med" as const, due: "11 Jun", assignee: "u5", tags: ["Front-end"], subDone: 1, subTotal: 4, comments: 2 },
  { title: "Setup do pipeline CI/CD", proj: "p3", col: "doing" as const, pr: "low" as const, due: "09 Jun", assignee: "u10", tags: ["DevOps"], subDone: 3, subTotal: 3, comments: 0 },
  { title: "Testes de carga na API", proj: "p6", col: "review" as const, pr: "high" as const, due: "08 Jun", assignee: "u6", tags: ["QA"], subDone: 5, subTotal: 5, comments: 3 },
  { title: "Revisão de acessibilidade WCAG", proj: "p7", col: "review" as const, pr: "med" as const, due: "13 Jun", assignee: "u3", tags: ["Design", "A11y"], subDone: 2, subTotal: 4, comments: 5 },
  { title: "Documentar endpoints v2", proj: "p6", col: "done" as const, pr: "low" as const, due: "05 Jun", assignee: "u2", tags: ["Docs"], subDone: 4, subTotal: 4, comments: 1 },
  { title: "Migrar buckets de storage", proj: "p3", col: "done" as const, pr: "med" as const, due: "04 Jun", assignee: "u10", tags: ["Infra"], subDone: 6, subTotal: 6, comments: 2 },
  { title: "Kickoff com stakeholders", proj: "p8", col: "done" as const, pr: "high" as const, due: "02 Jun", assignee: "u1", tags: ["Gestão"], subDone: 1, subTotal: 1, comments: 8 },
  { title: "Integrar gateway PIX", proj: "p8", col: "todo" as const, pr: "high" as const, due: "16 Jun", assignee: "u4", tags: ["Integração"], subDone: 0, subTotal: 5, comments: 0 },
  { title: "Protótipo navegável — onboarding", proj: "p2", col: "doing" as const, pr: "med" as const, due: "12 Jun", assignee: "u3", tags: ["Design"], subDone: 2, subTotal: 3, comments: 6 },
];

const MILESTONES_P2 = [
  { title: "Kickoff & discovery", state: "done" as const, date: "02 Mar" },
  { title: "Design system aprovado", state: "done" as const, date: "28 Mar" },
  { title: "MVP funcional", state: "doing" as const, date: "30 Jun" },
  { title: "Testes & QA", state: "todo" as const, date: "22 Jul" },
  { title: "Go-live", state: "todo" as const, date: "15 Jul" },
];

const TIME_LOGS = [
  { user: "u2", proj: "p1", task: "Arquitetura do app", dur: "3:42:10", start: "09:02", status: "running" as const },
  { user: "u3", proj: "p7", task: "Tokens de cor", dur: "2:18:44", start: "09:15", status: "paused" as const },
  { user: "u4", proj: "p1", task: "Modelagem de dados", dur: "4:05:21", start: "08:48", status: "done" as const },
  { user: "u5", proj: "p4", task: "Gráfico de gastos", dur: "1:52:09", start: "10:30", status: "running" as const },
  { user: "u6", proj: "p6", task: "Testes de carga", dur: "2:44:55", start: "09:40", status: "done" as const },
  { user: "u10", proj: "p3", task: "Pipeline CI/CD", dur: "3:12:33", start: "08:30", status: "done" as const },
  { user: "u7", proj: "p4", task: "Limpeza de base", dur: "1:30:00", start: "11:00", status: "paused" as const },
];

async function main() {
  // Trava de segurança: o seed APAGA tudo antes de recriar. Nunca rodar em produção
  // por acidente (apagaria dados reais). Para forçar mesmo assim: SEED_ALLOW_PROD=1.
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PROD !== "1") {
    console.error("Seed bloqueado em produção (NODE_ENV=production). Crie o admin via /register.");
    console.error("Para forçar (vai APAGAR dados): SEED_ALLOW_PROD=1 npm run db:seed");
    process.exit(1);
  }

  console.log("Limpando dados…");
  await db.timeLog.deleteMany();
  await db.taskTag.deleteMany();
  await db.task.deleteMany();
  await db.milestone.deleteMany();
  await db.projectMember.deleteMany();
  await db.project.deleteMany();
  await db.user.deleteMany();
  await db.workspace.deleteMany();

  const ws = await db.workspace.create({ data: { name: "Vërtex", slug: "vertex" } });

  const passwordHash = await bcrypt.hash("openboard123", 10);
  const userId: Record<string, string> = {};
  for (const u of TEAM) {
    const created = await db.user.create({
      data: {
        workspaceId: ws.id,
        name: u.name,
        email: `${slug(u.name)}@openboard.dev`,
        passwordHash,
        role: u.roleEnum,
        jobTitle: u.role,
        initials: u.initials,
        color: u.color,
      },
    });
    userId[u.key] = created.id;
  }

  const projectId: Record<string, string> = {};
  for (const p of PROJECTS) {
    const created = await db.project.create({
      data: {
        workspaceId: ws.id,
        name: p.name,
        client: p.client,
        tag: p.tag,
        status: p.status,
        manualProgress: p.progress, // seed mantém % manual; projetos novos usam progresso automático
        startDate: d(p.start),
        dueDate: d(p.dueLabel),
        budgetCents: p.budget,
        spentPct: p.spent,
        risk: p.risk,
        members: {
          create: p.members.map((m, i) => ({
            userId: userId[m],
            isLead: i === 0,
            order: i,
          })),
        },
      },
    });
    projectId[p.key] = created.id;
  }

  for (let i = 0; i < TASKS.length; i++) {
    const t = TASKS[i];
    // gera subtarefas a partir dos números do protótipo (subDone de subTotal feitas)
    const subtasks = Array.from({ length: t.subTotal }, (_, k) => ({
      title: `Subtarefa ${k + 1}`,
      done: k < t.subDone,
      order: k,
    }));
    await db.task.create({
      data: {
        projectId: projectId[t.proj],
        title: t.title,
        column: t.col,
        priority: t.pr,
        dueDate: d(t.due),
        assigneeId: userId[t.assignee],
        order: i,
        tags: { create: t.tags.map((label) => ({ label })) },
        subtasks: subtasks.length ? { create: subtasks } : undefined,
      },
    });
  }

  for (let i = 0; i < MILESTONES_P2.length; i++) {
    const m = MILESTONES_P2[i];
    await db.milestone.create({
      data: { projectId: projectId["p2"], title: m.title, state: m.state, date: d(m.date), order: i },
    });
  }

  for (const l of TIME_LOGS) {
    await db.timeLog.create({
      data: {
        userId: userId[l.user],
        projectId: projectId[l.proj],
        taskTitle: l.task,
        durationSec: secs(l.dur),
        startedAt: at(l.start),
        status: l.status,
      },
    });
  }

  console.log(`Seed OK: ${TEAM.length} usuários, ${PROJECTS.length} projetos, ${TASKS.length} tarefas.`);
  console.log("Login de teste: marina@openboard.dev / openboard123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
