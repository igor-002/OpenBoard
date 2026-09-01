import { test } from "node:test";
import assert from "node:assert/strict";
import { cached } from "../src/lib/ttl-cache";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("single-flight: chamadas simultâneas fazem uma busca só", async () => {
  let n = 0;
  const fn = async () => { n++; await sleep(30); return n; };
  const [a, b, c] = await Promise.all([
    cached("k1", 10_000, fn), cached("k1", 10_000, fn), cached("k1", 10_000, fn),
  ]);
  assert.equal(n, 1);
  assert.deepEqual([a, b, c], [1, 1, 1]);
});

test("hit fresco não rebusca", async () => {
  let n = 0;
  const fn = async () => { n++; return n; };
  await cached("k2", 10_000, fn);
  await cached("k2", 10_000, fn);
  assert.equal(n, 1);
});

test("stale-while-revalidate: devolve velho na hora e renova atrás", async () => {
  let n = 0;
  const fn = async () => { n++; await sleep(20); return n; };
  assert.equal(await cached("k3", 20, fn), 1);
  await sleep(40); // expira
  const t = Date.now();
  assert.equal(await cached("k3", 20, fn), 1, "deve servir o valor velho");
  assert.ok(Date.now() - t < 15, "não pode esperar a revalidação");
  await sleep(50);
  assert.equal(await cached("k3", 20, fn), 2, "valor renovado no fundo");
});

test("falha sem valor anterior propaga; com valor anterior mantém o velho", async () => {
  await assert.rejects(() => cached("k4", 1000, async () => { throw new Error("glpi fora"); }));
  assert.equal(await cached("k5", 20, async () => "bom"), "bom");
  await sleep(40);
  assert.equal(await cached("k5", 20, async () => { throw new Error("glpi fora"); }), "bom");
  await sleep(20);
  assert.equal(await cached("k5", 20, async () => "novo"), "bom", "erro na revalidação não apaga o cache");
});
