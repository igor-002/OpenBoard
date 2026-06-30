// Refresh rápido SÓ do status dos contratos (campo status_internet), sem recalcular MRR.
// Corrige dados puxados antes da troca status → status_internet.
// Rodar: npx tsx --env-file=.env --conditions=react-server scripts/ixc-status-refresh.ts
import { db } from "@/lib/db";
import { ixcListAll, FILIAIS, CAMPO_STATUS } from "@/lib/ixc";

async function main() {
  let atualizados = 0;
  for (const filial of FILIAIS) {
    const regs = await ixcListAll("cliente_contrato", {
      qtype: "cliente_contrato.id_filial",
      query: filial,
      oper: "=",
      rp: 500,
    });
    // Atualiza em lotes.
    for (let i = 0; i < regs.length; i += 200) {
      const slice = regs.slice(i, i + 200);
      await Promise.allSettled(
        slice.map((c) => {
          const status = String(c[CAMPO_STATUS] ?? c.status ?? "A");
          return db.contrato.updateMany({ where: { ixcId: String(c.id) }, data: { status } });
        }),
      );
      atualizados += slice.length;
      process.stdout.write(`\rfilial ${filial}: ${atualizados} processados`);
    }
  }
  console.log(`\nOK — ${atualizados} contratos com status atualizado (${CAMPO_STATUS}).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
