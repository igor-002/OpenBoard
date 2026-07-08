// Datas exatas dos IDs divergentes do set-diff fev/2026 (sem R$).
import { PrismaClient } from "../src/generated/prisma";

const db = new PrismaClient();

const OLD_ONLY = ["24288", "24423", "24592"];
const MINE_ONLY_B = ["22897", "24153", "24166", "24233", "24240", "24289", "24292", "24329", "24349", "24350", "24356", "24408"];
const MINE_ONLY_CAD = ["24302", "24311", "24352", "24391", "24392", "24393", "24394", "24407", "24416", "24474", "24507", "24566", "24602", "24603"];

async function dump(titulo: string, ids: string[]) {
  const rows = await db.contrato.findMany({
    where: { ixcId: { in: ids } },
    select: { ixcId: true, vendedorIxcId: true, status: true, dataCadastro: true, dataAtivacao: true },
    orderBy: { ixcId: "asc" },
  });
  console.log(`\n== ${titulo} ==`);
  const found = new Set(rows.map((r) => r.ixcId));
  for (const r of rows) {
    console.log(`${r.ixcId}\tvend=${r.vendedorIxcId}\tst=${r.status}\tcad=${r.dataCadastro?.toISOString().slice(0, 10) ?? "—"}\tativ=${r.dataAtivacao?.toISOString().slice(0, 10) ?? "—"}`);
  }
  for (const id of ids.filter((i) => !found.has(i))) console.log(`${id}\tNÃO EXISTE no espelho`);
}

async function main() {
  await dump("SÓ NO ANTIGO (fev deles, não no meu fev)", OLD_ONLY);
  await dump("SÓ AQUI — ativados fev (não no snapshot deles)", MINE_ONLY_B);
  await dump("SÓ AQUI — cadastrados fev sem ativação", MINE_ONLY_CAD);
}

main().finally(() => db.$disconnect());
