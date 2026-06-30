// Sync IXCSoft → Postgres local (espelho). Server-only.
// Segue IXC_INTEGRATION_HANDOFF.md: filiais permitidas (§8), MRR limpo (§5),
// datas por status (§7), lotes resilientes (§9) e log de execução (§9).
import "server-only";
import { db } from "@/lib/db";
import {
  ixcListAll,
  ixcBatch,
  ixcDate,
  moneyToCents,
  FILIAIS,
  CAMPO_STATUS,
  ixcConfigured,
  type IxcRecord,
} from "@/lib/ixc";

// ── Vendedores (tabela `vendedor`, status 'A') ───────────────────────────────
export async function syncVendedores(): Promise<number> {
  const regs = await ixcListAll("vendedor", {
    qtype: "vendedor.status",
    query: "A",
    oper: "=",
    rp: 200,
  });
  await ixcBatch(regs, async (v) => {
    const nome = v.nome || v.funcionario || `#${v.id}`;
    await db.vendedor.upsert({
      where: { ixcId: String(v.id) },
      create: { ixcId: String(v.id), nome, status: "A" },
      update: { nome, status: "A", syncedAt: new Date() },
    });
  });
  return regs.length;
}

// ── MRR limpo de um contrato (handoff §5) ────────────────────────────────────
// Produtos têm 2 vínculos: "Contrato" (id_contrato) e "Plano" (id_vd_contrato).
// Consultar os dois e deduplicar por id. Descontos subtraem, acréscimos somam,
// ambos vinculados ao produto por id_vd_contrato_produtos.
async function calcMrrCents(contrato: IxcRecord): Promise<number> {
  const idContrato = String(contrato.id);
  const idPlano = String(contrato.id_vd_contrato ?? "0");

  const buscas: Promise<IxcRecord[]>[] = [
    ixcListAll("vd_contratos_produtos", { qtype: "vd_contratos_produtos.id_contrato", query: idContrato, oper: "=", rp: 200 }),
  ];
  if (idPlano && idPlano !== "0") {
    buscas.push(
      ixcListAll("vd_contratos_produtos", { qtype: "vd_contratos_produtos.id_vd_contrato", query: idPlano, oper: "=", rp: 200 }),
    );
  }
  const produtos = dedupeById(([] as IxcRecord[]).concat(...(await Promise.all(buscas))));

  // Descontos e acréscimos por id_contrato → mapa por id_vd_contrato_produtos.
  const [descontos, acrescimos] = await Promise.all([
    ixcListAll("cliente_contrato_descontos", { qtype: "cliente_contrato_descontos.id_contrato", query: idContrato, oper: "=", rp: 200 }),
    ixcListAll("cliente_contrato_acrescimos", { qtype: "cliente_contrato_acrescimos.id_contrato", query: idContrato, oper: "=", rp: 200 }),
  ]);
  const descByProd = sumByProduto(descontos);
  const acreByProd = sumByProduto(acrescimos);

  let mrr = 0;
  for (const p of produtos) {
    const qtde = Number(p.qtde || "1") || 1;
    // valor_liquido (preferir) ou valor_unit * qtde.
    const base = p.valor_liquido ? moneyToCents(p.valor_liquido) : moneyToCents(p.valor_unit) * qtde;
    const desc = descByProd.get(String(p.id)) ?? 0;
    const acre = acreByProd.get(String(p.id)) ?? 0;
    mrr += Math.max(0, base - desc) + acre;
  }
  return mrr;
}

function dedupeById(regs: IxcRecord[]): IxcRecord[] {
  const seen = new Map<string, IxcRecord>();
  for (const r of regs) seen.set(String(r.id), r);
  return [...seen.values()];
}

// Soma valores (campo `valor`, NÃO `valor_acrescimo` — handoff §5) por produto.
function sumByProduto(regs: IxcRecord[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of regs) {
    const key = String(r.id_vd_contrato_produtos ?? "");
    if (!key) continue;
    m.set(key, (m.get(key) ?? 0) + moneyToCents(r.valor));
  }
  return m;
}

// ── Contratos (tabela `cliente_contrato`) ────────────────────────────────────
// Escopo (handoff PARTE 1): só vendedores com `incluirHistorico=true`. Sem isso o
// pull traz a base inteira (lento). Puxa contratos por id_vendedor e filtra filial
// em JS ({1,2,6}).
export async function syncContratos(): Promise<{ processed: number; errors: number; vendedoresUsados: number }> {
  const autorizados = await db.vendedor.findMany({
    where: { incluirHistorico: true },
    select: { ixcId: true },
  });
  if (autorizados.length === 0) {
    return { processed: 0, errors: 0, vendedoresUsados: 0 };
  }

  const filiaisOk = new Set(FILIAIS);
  const todos: IxcRecord[] = [];
  for (const v of autorizados) {
    const regs = await ixcListAll("cliente_contrato", {
      qtype: "cliente_contrato.id_vendedor",
      query: v.ixcId,
      oper: "=",
      rp: 200,
    });
    // Filtro de filial em JS (handoff §filiais).
    todos.push(...regs.filter((c) => filiaisOk.has(String(c.id_filial ?? ""))));
  }

  const { errors } = await ixcBatch(
    todos,
    async (c) => {
      const status = String(c[CAMPO_STATUS] ?? c.status ?? "A");
      const clienteIxcId = String(c.id_cliente);

      // Garante o cliente (espelho mínimo) antes do contrato (FK por ixcId).
      await upsertCliente(clienteIxcId);

      const mrrCents = await calcMrrCents(c);
      // Data de referência por status (handoff §7).
      const dataAtivacao = ixcDate(c.data_ativacao);
      const dataCadastro = ixcDate(c.data_cadastro_sistema ?? c.data);

      await db.contrato.upsert({
        where: { ixcId: String(c.id) },
        create: {
          ixcId: String(c.id),
          status,
          filial: String(c.id_filial ?? ""),
          mrrCents,
          taxaInstalacaoCents: moneyToCents(c.taxa_instalacao),
          idVdContrato: c.id_vd_contrato ? String(c.id_vd_contrato) : null,
          dataAtivacao,
          dataCadastro,
          clienteIxcId,
          vendedorIxcId: c.id_vendedor ? String(c.id_vendedor) : null,
        },
        update: {
          status,
          filial: String(c.id_filial ?? ""),
          mrrCents,
          taxaInstalacaoCents: moneyToCents(c.taxa_instalacao),
          idVdContrato: c.id_vd_contrato ? String(c.id_vd_contrato) : null,
          dataAtivacao,
          dataCadastro,
          vendedorIxcId: c.id_vendedor ? String(c.id_vendedor) : null,
          syncedAt: new Date(),
        },
      });
    },
    10, // lote (handoff §9)
  );
  return { processed: todos.length, errors, vendedoresUsados: autorizados.length };
}

async function upsertCliente(ixcId: string): Promise<void> {
  const exists = await db.ixcCliente.findUnique({ where: { ixcId }, select: { id: true } });
  if (exists) return;
  const [c] = await ixcListAll("cliente", { qtype: "cliente.id", query: ixcId, oper: "=", rp: 1 });
  await db.ixcCliente.upsert({
    where: { ixcId },
    create: {
      ixcId,
      razao: c?.razao || c?.fantasia || `Cliente #${ixcId}`,
      cnpjCpf: c?.cnpj_cpf ?? null,
      uf: c?.uf ?? null,
    },
    update: {},
  });
}

// ── Orquestrador com log (handoff §9) ────────────────────────────────────────
export async function runFullSync(): Promise<{ ok: boolean; runId: string; error?: string }> {
  if (!ixcConfigured()) {
    return { ok: false, runId: "", error: "IXC não configurado (defina IXC_TOKEN/IXC_PROXY_URL)." };
  }
  const run = await db.syncRun.create({ data: { kind: "full" } });
  const t0 = Date.now();
  try {
    const nVend = await syncVendedores();
    const { processed, errors } = await syncContratos();
    await db.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        durationMs: Date.now() - t0,
        processed: nVend + processed,
        errors,
      },
    });
    return { ok: true, runId: run.id };
  } catch (e) {
    const msg = (e as Error).message;
    await db.syncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), durationMs: Date.now() - t0, fatalError: msg },
    });
    return { ok: false, runId: run.id, error: msg };
  }
}
