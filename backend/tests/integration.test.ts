import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./database";
import app from "../src/app";
import { today } from "../src/chat/validation";
let db: any, server: any, base: string, token: string, other: string;
async function request(path: string, method = "GET", body?: any, t = token) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: r.status === 204 ? null : await r.json() };
}
const chat = (message: string, t = token) =>
  request("/api/chat", "POST", { message }, t);
const food = (
  name = "Arroz",
  quantity = 1,
  unit = "kg",
  expirationDate = "2099-12-31",
) => ({
  name,
  quantity,
  unit,
  expirationDate,
  category: "Cereais",
  storageLocation: "despensa",
});
before(async () => {
  process.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters";
  db = await testDatabase();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const email of ["a@example.test", "b@example.test"]) {
    const r = await request(
      "/api/auth/register",
      "POST",
      { name: "Pessoa Teste", email, password: "Teste123!" },
      "",
    );
    assert.equal(r.status, 201);
    const s = await request(
      "/api/auth/login",
      "POST",
      { email, password: "Teste123!" },
      "",
    );
    if (email[0] === "a") token = s.data.token;
    else other = s.data.token;
  }
});
after(async () => {
  await new Promise<void>((resolve) => server.close(resolve));
  await db.close();
});
test("autenticação obrigatória", async () => {
  assert.equal((await request("/api/foods", "GET", undefined, "")).status, 401);
  assert.equal((await chat("oi", "invalid")).status, 401);
});
test("CRUD com isolamento por conta", async () => {
  const r = await request("/api/foods", "POST", food());
  assert.equal(r.status, 201);
  assert.equal(
    (await request("/api/foods", "GET", undefined, other)).data.length,
    0,
  );
  assert.equal(
    (await request("/api/foods/" + r.data.id, "PUT", food("Invadido"), other))
      .status,
    404,
  );
  assert.equal(
    (await request("/api/foods/" + r.data.id, "DELETE", undefined, other))
      .status,
    404,
  );
});
test("validação rejeita datas irreais, quantidades inválidas e unidades desconhecidas", async () => {
  for (const f of [
    food("x", -2),
    food("x", 1, "g", "2026-02-31"),
    food("x", 1, "pacote"),
    { ...food(), quantity: "2" },
    food("x", 0.001),
  ])
    assert.equal((await request("/api/foods", "POST", f)).status, 400);
});
test("consulta lê o banco verdadeiro", async () => {
  assert.match((await chat("Tenho arroz?")).data.reply, /Arroz/);
  assert.doesNotMatch((await chat("Tenho arroz?", other)).data.reply, /1 kg/);
});
test("baixa converte g para kg, exige confirmação e persiste saldo", async () => {
  let r = await chat("Usei 200 g de arroz");
  assert.match(r.data.reply, /800 g/);
  assert.equal((await request("/api/foods")).data[0].quantity, 1);
  r = await chat("Confirmar");
  assert.equal(r.data.changed, true);
  assert.equal((await request("/api/foods")).data[0].quantity, 0.8);
});
test("confirmar novamente não desconta duas vezes", async () => {
  await chat("Confirmar");
  assert.equal((await request("/api/foods")).data[0].quantity, 0.8);
});
test("baixa excessiva e unidade incompatível não alteram o saldo", async () => {
  assert.match((await chat("Usei 5 kg de arroz")).data.reply, /não ultrapasse/);
  await chat("Cancelar");
  assert.match(
    (await chat("Usei 200 ml de arroz")).data.reply,
    /unidade compatível/,
  );
  await chat("Cancelar");
  assert.equal((await request("/api/foods")).data[0].quantity, 0.8);
});
test("cadastro por conversa pergunta campos faltantes e confirma", async () => {
  const r = await chat(
    "Comprei 1 litro de leite, vence 31/12/2099 e fica na geladeira",
  );
  assert.match(r.data.reply, /Confirma o cadastro/);
  assert.match(r.data.reply, /Quantidade: 1 l/);
  await chat("Confirmar");
  const f = (await request("/api/foods")).data.find(
    (f: any) => f.name === "leite",
  );
  assert.equal(f.storageLocation, "geladeira");
});
test("edição guiada altera validade", async () => {
  await chat("Editar leite");
  await chat("Validade");
  let r = await chat("30/12/2099");
  assert.match(r.data.reply, /Confirma/);
  r = await chat("Confirmar");
  assert.equal(r.data.changed, true);
});
test("alimentos duplicados exigem seleção por ID", async () => {
  await request("/api/foods", "POST", food("Arroz", 2));
  let r = await chat("Usei 100 g de arroz");
  assert.match(r.data.reply, /Qual destes alimentos/);
  const f = (await request("/api/foods")).data.find(
    (f: any) => f.name === "Arroz" && f.quantity === 2,
  );
  r = await chat("#" + f.id);
  assert.match(r.data.reply, /1,9 kg/);
  await chat("Cancelar");
});
test("alteração externa durante confirmação cancela a operação pendente", async () => {
  await chat("Usei 100 ml de leite");
  const f = (await request("/api/foods")).data.find(
    (f: any) => f.name === "leite",
  );
  await request("/api/foods/" + f.id, "PUT", {
    ...f,
    expirationDate: f.expirationDate.slice(0, 10),
    quantity: 2,
  });
  const r = await chat("Confirmar");
  assert.match(r.data.reply, /alterado ou excluído/);
  assert.equal(r.data.changed, false);
});
test("cancelar exclusão preserva alimento, confirmar remove", async () => {
  await chat("Excluir leite");
  await chat("Cancelar");
  assert.ok(
    (await request("/api/foods")).data.some((f: any) => f.name === "leite"),
  );
  await chat("Excluir leite");
  assert.equal((await chat("Confirmar")).data.changed, true);
  assert.ok(
    !(await request("/api/foods")).data.some((f: any) => f.name === "leite"),
  );
});
test("baixa total mantém saldo zero, sem sugerir item como disponível", async () => {
  await request("/api/foods", "POST", food("Banana", 2, "un"));
  await chat("Usei 2 un de banana");
  await chat("Confirmar");
  assert.equal(
    (await request("/api/foods")).data.find((f: any) => f.name === "Banana")
      .quantity,
    0,
  );
});
test("validades distinguem vencidos e hoje", async () => {
  assert.equal(
    (await request("/api/foods", "POST", food("Tomate", 2, "un", "2000-01-01")))
      .status,
    400,
  );
  await request("/api/foods", "POST", food("Cenoura", 2, "un", today()));
  assert.match((await chat("O que vence hoje?")).data.reply, /Cenoura/);
  assert.doesNotMatch((await chat("O que vence hoje?")).data.reply, /Tomate/);
  assert.match((await chat("O que está vencido?")).data.reply, /já vencidos/);
});
test("receitas usam estoque e identificam faltantes sem descontar", async () => {
  const before = (await request("/api/foods")).data;
  let r = await chat("Sugerir receitas");
  assert.match(r.data.reply, /Arroz com cenoura/);
  assert.match(r.data.reply, /Falta comprar/);
  assert.doesNotMatch(r.data.reply, /Você tem: tomate/);
  assert.deepEqual((await request("/api/foods")).data, before);
});
test("histórico persiste e é isolado", async () => {
  assert.ok((await request("/api/chat/history")).data.length > 10);
  assert.ok(
    (await request("/api/chat/history", "GET", undefined, other)).data.every(
      (m: any) => !m.content.includes("Consumo registrado"),
    ),
  );
});
test("mensagens inválidas e texto desconhecido têm resposta controlada", async () => {
  assert.equal((await chat("")).status, 400);
  assert.equal(
    (await request("/api/chat", "POST", { message: 45 })).status,
    400,
  );
  assert.match(
    (await chat("Qual a capital da França?")).data.reply,
    /Fiquei em dúvida/,
  );
});

test("apagar histórico cancela operação pendente, preserva alimentos e outra conta", async () => {
  const beforeFoods = (await request("/api/foods")).data;
  const otherHistory = (
    await request("/api/chat/history", "GET", undefined, other)
  ).data;
  await chat("Excluir cenoura");
  assert.equal((await request("/api/chat/history", "DELETE")).status, 204);
  assert.equal((await request("/api/chat/history")).data.length, 0);
  assert.deepEqual((await request("/api/foods")).data, beforeFoods);
  assert.deepEqual(
    (await request("/api/chat/history", "GET", undefined, other)).data,
    otherHistory,
  );
  assert.equal((await chat("Confirmar")).data.changed, false);
  assert.deepEqual((await request("/api/foods")).data, beforeFoods);
});
test("validade opcional persiste NULL no PostgreSQL e aparece em consulta", async () => {
  const r = await request("/api/foods", "POST", {
    ...food("Aveia", 1, "kg"),
    expirationDate: null,
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.expirationDate, null);
  assert.match(
    (await chat("quais estão sem data de validade")).data.reply,
    /Aveia/,
  );
});

test("omitir a validade no cadastro também salva NULL", async () => {
  const body: any = food("Feijão", 1, "kg");
  delete body.expirationDate;
  const result = await request("/api/foods", "POST", body);
  assert.equal(result.status, 201);
  assert.equal(result.data.expirationDate, null);
});
