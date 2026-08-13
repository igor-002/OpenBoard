import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { POST } from "@/app/api/v1/integrations/ploomes/projects/route";
import { GET as getCategories } from "@/app/api/v1/integrations/options/project-categories/route";
import { GET as getUsers } from "@/app/api/v1/integrations/options/users/route";
import { db } from "@/lib/db";

const token = "ploomes-integration-test-token";
let workspaceId = "";
let categoryId = "";
let userOneId = "";
let userTwoId = "";
let inactiveUserId = "";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function input(id: string) {
  return {
    eventId: `ploomes-deal-${id}-won`,
    source: "ploomes",
    ploomes: { dealId: Number(id.replace(/\D/g, "")) || 1, contactId: 503992654, pipelineId: 50008796, dealTitle: "Lead teste" },
    client: {
      externalId: `ploomes-contact-${id}`,
      name: `Empresa ${id}`,
      email: `contato-${id}@example.test`,
      phone: "5511999999999",
      document: `1234567800${String(id).replace(/\D/g, "").padStart(2, "0").slice(-2)}`,
    },
    project: { name: `Implantação ${id}`, categoryId, status: "planejado", startDate: null, dueDate: null, teamUserIds: [userOneId, userTwoId] },
    notifications: { userIds: [userOneId, userTwoId], title: "Novo projeto vendido", message: "Projeto criado pelo Ploomes." },
  };
}

function request(body: unknown, idempotencyKey: string, authorization = `Bearer ${token}`) {
  return new Request("http://openboard.test/api/v1/integrations/ploomes/projects", {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
}

before(async () => {
  process.env.INTEGRATION_TOKEN = token;
  const workspace = await db.workspace.create({ data: { name: `Ploomes test ${suffix}`, slug: `ploomes-test-${suffix}` } });
  workspaceId = workspace.id;
  process.env.INTEGRATION_WORKSPACE_ID = workspaceId;
  const users = await Promise.all([
    db.user.create({ data: { workspaceId, name: "Teste Um", email: `one-${suffix}@example.test`, passwordHash: "test", jobTitle: "Teste", initials: "TU", color: "#111" } }),
    db.user.create({ data: { workspaceId, name: "Teste Dois", email: `two-${suffix}@example.test`, passwordHash: "test", jobTitle: "Teste", initials: "TD", color: "#222" } }),
    db.user.create({ data: { workspaceId, name: "Teste Inativo", email: `inactive-${suffix}@example.test`, passwordHash: "test", jobTitle: "Teste", initials: "TI", color: "#333", active: false } }),
  ]);
  userOneId = users[0].id;
  userTwoId = users[1].id;
  inactiveUserId = users[2].id;
  const category = await db.projectCategory.create({ data: { workspaceId, name: "Onboarding", key: "onboarding" } });
  categoryId = category.id;
});

after(async () => {
  if (workspaceId) await db.workspace.delete({ where: { id: workspaceId } });
  delete process.env.INTEGRATION_TOKEN;
  delete process.env.INTEGRATION_WORKSPACE_ID;
});

test("rejects invalid service authentication", async () => {
  const response = await POST(request(input("101"), "key-auth", "Bearer wrong"));
  assert.equal(response.status, 401);
});

test("creates client, project, members and notifications", async () => {
  const response = await POST(request(input("102"), "key-create"));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.created, true);
  assert.equal(body.project.status, "planejado");
  assert.equal(body.notificationsCreated, 2);
  assert.equal(await db.projectMember.count({ where: { projectId: body.project.id } }), 2);
  const project = await db.project.findUniqueOrThrow({ where: { id: body.project.id } });
  assert.equal(project.startDate, null);
  assert.equal(project.dueDate, null);
});

test("replay returns same result without duplicate notifications", async () => {
  const payload = input("103");
  const first = await POST(request(payload, "key-replay"));
  const created = await first.json();
  const replay = await POST(request(payload, "key-replay"));
  assert.equal(replay.status, 200);
  const repeated = await replay.json();
  assert.equal(repeated.created, false);
  assert.equal(repeated.idempotent, true);
  assert.equal(repeated.project.id, created.project.id);
  assert.equal(await db.notification.count({ where: { link: `/projects/${created.project.id}` } }), 2);
});

test("uses existing client found by document and email", async () => {
  const payload = input("104");
  const existing = await db.projectClient.create({
    data: {
      workspaceId,
      name: "Cliente existente",
      email: payload.client.email,
      emailNorm: payload.client.email!.toLowerCase(),
      document: payload.client.document,
      documentNorm: payload.client.document!,
    },
  });
  const response = await POST(request(payload, "key-existing-client"));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.client.id, existing.id);
  const updated = await db.projectClient.findUniqueOrThrow({ where: { id: existing.id } });
  assert.equal(updated.externalId, payload.client.externalId);
});

test("rejects invalid team without creating project", async () => {
  const payload = input("105");
  payload.project.teamUserIds = ["missing-user"];
  const response = await POST(request(payload, "key-invalid-team"));
  assert.equal(response.status, 404);
  assert.equal(await db.project.count({ where: { source: "ploomes", externalDealId: "105" } }), 0);
});

test("rejects a second event for the same Ploomes deal", async () => {
  const first = input("106");
  assert.equal((await POST(request(first, "key-deal-1"))).status, 201);

  // Mesmo negócio chegando com outro eventId: não é replay, é conflito.
  const second = { ...input("106"), eventId: "ploomes-deal-106-won-again" };
  const response = await POST(request(second, "key-deal-2"));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "external_deal_conflict");
  assert.equal(await db.project.count({ where: { source: "ploomes", externalDealId: "106" } }), 1);
});

test("rejects the same Idempotency-Key reused for another event", async () => {
  assert.equal((await POST(request(input("107"), "key-shared"))).status, 201);

  const response = await POST(request(input("108"), "key-shared"));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "idempotency_conflict");
  assert.equal(await db.project.count({ where: { source: "ploomes", externalDealId: "108" } }), 0);
});

test("rejects an inactive user on the team", async () => {
  const payload = input("109");
  payload.project.teamUserIds = [userOneId, inactiveUserId];
  const response = await POST(request(payload, "key-inactive-user"));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "user_not_found");
  assert.equal(await db.project.count({ where: { source: "ploomes", externalDealId: "109" } }), 0);
});

// NODE_ENV é readonly no tipo, mas o valor precisa mudar para exercitar a trava
// de HTTPS — que só liga em produção.
const NODE_ENV = process.env.NODE_ENV;
const setNodeEnv = (value: string | undefined) => Object.assign(process.env, { NODE_ENV: value });

test("refuses plain HTTP in production", async () => {
  setNodeEnv("production");
  try {
    const response = await POST(request(input("110"), "key-https"));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "https_required");
  } finally {
    setNodeEnv(NODE_ENV);
  }
});

test("accepts a forwarded HTTPS request in production", async () => {
  setNodeEnv("production");
  try {
    const proxied = new Request("http://openboard.test/api/v1/integrations/ploomes/projects", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "key-https-ok",
        // é isso que o nginx sobrescreve no deploy
        "X-Forwarded-Proto": "https",
      },
      body: JSON.stringify(input("111")),
    });
    assert.equal((await POST(proxied)).status, 201);
  } finally {
    setNodeEnv(NODE_ENV);
  }
});

test("returns only active option records", async () => {
  const [categoryResponse, userResponse] = await Promise.all([
    getCategories(new Request("http://openboard.test/api/v1/integrations/options/project-categories", { headers: { Authorization: `Bearer ${token}` } })),
    getUsers(new Request("http://openboard.test/api/v1/integrations/options/users", { headers: { Authorization: `Bearer ${token}` } })),
  ]);
  assert.equal(categoryResponse.status, 200);
  assert.equal(userResponse.status, 200);
  const categories = await categoryResponse.json();
  const users = await userResponse.json();
  assert.ok(categories.categories.some((category: { id: string }) => category.id === categoryId));
  assert.ok(users.users.some((user: { id: string }) => user.id === userOneId));
  assert.ok(!users.users.some((user: { id: string }) => user.id === inactiveUserId));
});
