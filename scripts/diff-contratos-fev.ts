// Lista IDs de contrato de fev/2026 do OpenBoard em 3 cortes, pra diff ID a ID
// com o vendas_historico do sistema antigo (sem valores R$ — só IDs/datas/status).
// Roda: npx tsx scripts/diff-contratos-fev.ts  → imprime e salva scripts/out-diff-fev.txt
import { PrismaClient } from "../src/generated/prisma";
import { appendFileSync, writeFileSync } from "fs";

const db = new PrismaClient();
const OUT = "scripts/out-diff-fev.txt";
writeFileSync(OUT, `Gerado em ${new Date().toISOString()}\n`);
function log(...args: unknown[]) {
  const line = args.join(" ");
  console.log(line);
  appendFileSync(OUT, line + "\n");
}

async function main() {
  const inicio = new Date(Date.UTC(2026, 1, 1));
  const fim = new Date(Date.UTC(2026, 2, 1));
  const vendedores = await db.vendedor.findMany({ where: { ativo: true }, select: { ixcId: true } });
  const gate = { vendedorIxcId: { in: vendedores.map((v) => v.ixcId) } };

  // Corte B: ativado em fev (qualquer status atual)
  const ativados = await db.contrato.findMany({
    where: { ...gate, dataAtivacao: { gte: inicio, lt: fim } },
    select: { ixcId: true, vendedorIxcId: true, status: true, dataCadastro: true },
    orderBy: { ixcId: "asc" },
  });
  // Regra do antigo (aprox): não-ativados entram pelo cadastro
  const porCadastro = await db.contrato.findMany({
    where: { ...gate, dataAtivacao: null, dataCadastro: { gte: inicio, lt: fim } },
    select: { ixcId: true, vendedorIxcId: true, status: true },
    orderBy: { ixcId: "asc" },
  });

  log(`\n== ATIVADOS em fev/2026 (${ativados.length}) — ixcId | vendedor | status atual | mês cadastro ==`);
  for (const c of ativados) log(`${c.ixcId}\t${c.vendedorIxcId}\t${c.status}\t${c.dataCadastro ? c.dataCadastro.toISOString().slice(0, 7) : "—"}`);

  log(`\n== SEM ATIVAÇÃO, cadastrados em fev/2026 (${porCadastro.length}) — regra do antigo põe no mês ==`);
  for (const c of porCadastro) log(`${c.ixcId}\t${c.vendedorIxcId}\t${c.status}`);

  log(`\nTotal corte B: ${ativados.length} · Total "regra antigo" (B + sem ativação por cadastro): ${ativados.length + porCadastro.length}`);
}

main().finally(() => db.$disconnect());
