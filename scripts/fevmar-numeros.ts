// Fev+Mar/2026 do OpenBoard, em DOIS cortes, pra comparar com vendas_historico do antigo.
//
// Corte A (dashboard OpenBoard hoje): dataAtivacao no mês E status ATUAL = 'A'.
// Corte B (comparável com snapshot): dataAtivacao no mês, QUALQUER status atual,
//   com breakdown do status atual. O vendas_historico do antigo congelou o status
//   da época; contrato ativado em fev e cancelado depois está lá como ativo de fev,
//   mas no corte A daqui ele some. Corte B é o que deve bater com o snapshot.
//
// Output vai pro console E pro arquivo scripts/out-fevmar-2026.txt (leitura sem copy-paste).
import { PrismaClient } from "../src/generated/prisma";
import { appendFileSync, writeFileSync } from "fs";

const db = new PrismaClient();

const OUT = "scripts/out-fevmar-2026.txt";
writeFileSync(OUT, `Gerado em ${new Date().toISOString()}\n`);
function log(...args: unknown[]) {
  const line = args.join(" ");
  console.log(line);
  appendFileSync(OUT, line + "\n");
}

async function mes(ano: number, m: number, gate: object) {
  const inicio = new Date(Date.UTC(ano, m - 1, 1));
  const fim = new Date(Date.UTC(ano, m, 1));
  const range = { gte: inicio, lt: fim };

  const [corteA, mrrA, corteB, mrrB, porStatus] = await Promise.all([
    db.contrato.count({ where: { ...gate, status: "A", dataAtivacao: range } }),
    db.contrato.aggregate({ _sum: { mrrCents: true }, where: { ...gate, status: "A", dataAtivacao: range } }),
    db.contrato.count({ where: { ...gate, dataAtivacao: range } }),
    db.contrato.aggregate({ _sum: { mrrCents: true }, where: { ...gate, dataAtivacao: range } }),
    db.contrato.groupBy({ by: ["status"], _count: true, where: { ...gate, dataAtivacao: range } }),
  ]);

  log(`\n=== ${String(m).padStart(2, "0")}/${ano} ===`);
  log("Corte A (ativado no mês + status atual A):", corteA, "| MRR líquido R$", ((mrrA._sum.mrrCents ?? 0) / 100).toFixed(2));
  log("Corte B (ativado no mês, qualquer status):", corteB, "| MRR líquido R$", ((mrrB._sum.mrrCents ?? 0) / 100).toFixed(2));
  log("Corte B por status atual:", porStatus.map((s) => `${s.status}=${s._count}`).sort().join(" "));
}

async function main() {
  const vendedores = await db.vendedor.findMany({ where: { ativo: true }, select: { ixcId: true, nome: true }, orderBy: { nome: "asc" } });
  const gate = { vendedorIxcId: { in: vendedores.map((v) => v.ixcId) } };

  log("=== Vendedores ativos (gate OpenBoard) ===");
  for (const v of vendedores) log(`${v.ixcId}\t${v.nome}`);

  await mes(2026, 2, gate);
  await mes(2026, 3, gate);

  log(`\nOK — resultado também salvo em ${OUT}`);
}

main().finally(() => db.$disconnect());
