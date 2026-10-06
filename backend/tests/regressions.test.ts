import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { respond, Store } from "../src/chat/engine";
import { expiryPeriod, formatQuantity } from "../src/chat/language";
import { suggest } from "../src/chat/recipes";
import { classify } from "../src/ml/classifier";
const item = (
  id: number,
  name: string,
  quantity: number,
  unit = "un",
  expirationDate: string | null = "2027-10-10",
) => ({
  id,
  name,
  quantity,
  unit,
  expirationDate,
  category: "Outros",
  storageLocation: "despensa",
});
function conversation(seed: any[]) {
  let foods = structuredClone(seed),
    state: any = {};
  const store: Store = {
    list: async () => structuredClone(foods),
    create: async (f) => {
      foods.push({ ...f, id: foods.length + 10 });
    },
    update: async (id, f) => {
      foods = foods.map((x) => (x.id === id ? { ...f } : x));
    },
    remove: async (id) => {
      foods = foods.filter((x) => x.id !== id);
    },
  };
  return {
    send: async (text: string) => {
      const r = await respond(text, state, store);
      state = r.state;
      return r;
    },
    foods: () => foods,
    state: () => state,
  };
}
test("PDF: compre dois ovos soma somente após escolha do lote e confirmação", async () => {
  const c = conversation([item(1, "Ovos", 2)]);
  let r = await c.send("comprei dois ovos");
  assert.ok(r.actions?.includes("Somar ao mesmo lote"));
  assert.equal(c.foods()[0].quantity, 2);
  r = await c.send("Somar ao mesmo lote");
  assert.match(r.reply, /4 un/);
  await c.send("Confirmar");
  assert.equal(c.foods()[0].quantity, 4);
  assert.equal(c.foods().length, 1);
});
test("PDF: troca de compra para consumo descarta apenas o pedido pendente", async () => {
  const c = conversation([item(1, "Ovos", 2)]);
  await c.send("comprei dois ovos");
  let r = await c.send("usei um ovo");
  assert.match(r.reply, /pedido anterior/);
  assert.equal(c.state().mode, "consume");
  await c.send("Confirmar");
  assert.equal(c.foods()[0].quantity, 1);
});
test("PDF: botões numéricos selecionam duplicados sem exigir #ID", async () => {
  const c = conversation([item(8, "Ovos", 2), item(99, "Ovos", 6)]);
  let r = await c.send("usei dois ovos");
  assert.equal(r.actions?.length, 2);
  r = await c.send(r.actions![1]);
  assert.equal(c.state().id, 99);
  await c.send("Confirmar");
  assert.equal(c.foods()[1].quantity, 4);
  assert.equal(c.foods()[0].quantity, 2);
});
test("PDF: 200g e saldo de 800g são exibidos em unidade legível", async () => {
  const c = conversation([item(1, "Carne", 1, "kg")]);
  const r = await c.send("usei 200g de carne");
  assert.match(r.reply, /200 g/);
  assert.match(r.reply, /800 g/);
  await c.send("Confirmar");
  assert.equal(c.foods()[0].quantity, 0.8);
  assert.equal(formatQuantity(0.5, "l"), "500 ml");
});
test("PDF: somente nome do alimento oferece ações ou cadastro", async () => {
  const c = conversation([item(1, "Ovos", 2)]);
  const r = await c.send("ovo");
  assert.ok(r.actions?.includes("Adicionar quantidade"));
  await c.send("Cancelar");
  const r2 = await c.send("leite");
  assert.ok(r2.actions?.includes("Cadastrar este alimento"));
  await c.send("Cadastrar este alimento");
  assert.equal(c.state().food.name, "leite");
});
test("PDF: validade pode ficar sem informação; cadastro não inventa data", async () => {
  const c = conversation([]);
  for (const s of [
    "Cadastrar alimento",
    "Leite",
    "Litros",
    "1",
    "geladeira",
    "Não informar",
  ])
    await c.send(s);
  assert.equal(c.state().food.expirationDate, null);
  assert.match((await c.send("Confirmar")).reply, /Não informada/);
  assert.equal(c.foods()[0].expirationDate, null);
});
test("PDF: receita distingue molho de tomate de tomate fresco", () => {
  const text = suggest(
    [item(1, "Molho de tomate", 1), item(2, "Ovos", 2)],
    false,
  );
  assert.match(text, /Ovos ao molho de tomate/);
  assert.match(text, /Você tem: ovo, molho de tomate/);
  assert.doesNotMatch(text, /Você tem: ovo, tomate/);
  assert.doesNotMatch(
    suggest([item(1, "Molho de tomate", 1)]),
    /Omelete de tomate|Sanduíche de queijo e tomate/,
  );
});
test("PDF: consultas por mês usam o período exato", async () => {
  const c = conversation([
    item(1, "Outubro", 1, "un", "2027-10-15"),
    item(2, "Novembro", 1, "un", "2027-11-20"),
  ]);
  const r = await c.send("o que vence em novembro de 2027");
  assert.match(r.reply, /Novembro/);
  assert.doesNotMatch(r.reply, /\*\*Outubro\*\*/);
});
test("calendário: próximo mês em dezembro avança o ano e respeita fevereiro bissexto", () => {
  assert.deepEqual(expiryPeriod("o que vence mês que vem", "2026-12-20"), {
    start: "2027-01-01",
    end: "2027-01-31",
    label: "em janeiro de 2027",
  });
  assert.equal(
    expiryPeriod("em fevereiro de 2028", "2026-10-05").end,
    "2028-02-29",
  );
  assert.equal(expiryPeriod("amanhã", "2026-10-31").start, "2026-11-01");
});
test("compra com outra validade cria outro lote sem somar ao antigo", async () => {
  const c = conversation([item(1, "Ovos", 2)]);
  let r = await c.send("comprei dois ovos, vence 20/11/2027");
  assert.match(r.reply, /outro lote/);
  await c.send("Confirmar");
  assert.equal(c.foods().length, 2);
  assert.equal(c.foods()[0].quantity, 2);
  assert.equal(c.foods()[1].expirationDate, "2027-11-20");
});
test("nova intenção durante perguntas de cadastro não vira categoria ou nome", async () => {
  const c = conversation([item(1, "Ovos", 2)]);
  await c.send("Comprei 1 litro de leite");
  await c.send("Usei um ovo");
  assert.equal(c.state().mode, "consume");
  await c.send("Confirmar");
  assert.equal(c.foods().length, 1);
  assert.equal(c.foods()[0].quantity, 1);
});
test("ML: probabilidades da implementação TypeScript coincidem com Python", () => {
  const fixtures = JSON.parse(readFileSync("ml/parity-fixtures.json", "utf8"));
  for (const f of fixtures) {
    const result = classify(f.text);
    assert.equal(result.intent, f.intent);
    result.scores.forEach((p: number, i: number) =>
      assert.ok(Math.abs(p - f.scores[i]) < 1e-8, `${f.text}: ${i}`),
    );
  }
});
test("ML: classificador treinado participa de uma decisão real da conversa", async () => {
  const c = conversation([item(1, "Ovos", 2)]);
  const r = await c.send("balanço do estoque");
  assert.equal(r.recognition.source, "ml");
  assert.equal(r.recognition.intent, "resumo");
  assert.match(r.reply, /Resumo da sua cozinha/);
});
test("estoque não se altera com consulta ou classificação incerta", async () => {
  const seed = [item(1, "Ovos", 2)];
  const c = conversation(seed);
  await c.send("queria uma coisa");
  await c.send("O que tenho na geladeira?");
  assert.deepEqual(c.foods(), seed);
});

test("PDF2: unidade antes da quantidade, sem categoria, data compacta e passada", async () => {
  const c = conversation([]);
  await c.send("Cadastrar alimento");
  let r = await c.send("Fermento");
  assert.equal(c.state().field, "unit");
  assert.ok(r.actions?.includes("Gramas"));
  r = await c.send("Gramas");
  assert.match(r.reply, /Quantos gramas.*Fermento/);
  await c.send("100");
  assert.equal(c.state().field, "storageLocation");
  await c.send("despensa");
  r = await c.send("01012023");
  assert.match(r.reply, /anterior a hoje/);
  assert.equal(c.state().field, "expirationDate");
  r = await c.send("31122099");
  assert.match(r.reply, /31\/12\/2099/);
  assert.doesNotMatch(r.reply, /Categoria/);
  await c.send("Confirmar");
  assert.equal(c.foods()[0].quantity, 100);
  assert.equal(c.foods()[0].unit, "g");
});
test("PDF2: sim aceita oferta de cadastro", async () => {
  const c = conversation([]);
  await c.send("bolacha");
  await c.send("sim");
  assert.equal(c.state().food.name, "bolacha");
  assert.equal(c.state().field, "unit");
});
test("PDF2: coloque na despensa e quantidade sem verbo iniciam cadastro", async () => {
  for (const text of [
    "coloque na despensa 7 bolachas",
    "7 bolachas",
    "cadastre 7 bolachas",
  ]) {
    const c = conversation([]);
    await c.send(text);
    assert.equal(c.state().food.name, "bolachas");
    assert.equal(c.state().food.quantity, 7);
    assert.equal(c.state().field, "unit");
    if (text.startsWith("coloque"))
      assert.equal(c.state().food.storageLocation, "despensa");
  }
});
test("PDF2: listar alimentos usa resposta consistente", async () => {
  const c = conversation([item(1, "Ovos", 6)]);
  const a = await c.send("liste meus alimentos");
  const b = await c.send("me fale todos os alimentos");
  assert.equal(a.reply, b.reply);
  assert.match(a.reply, /Ovos/);
});
test("PDF2: consumo pergunta nome antes de exibir opções", async () => {
  const c = conversation([item(1, "Ovos", 6), item(2, "Arroz", 500, "g")]);
  const r = await c.send("Registrar consumo");
  assert.equal(c.state().stage, "target");
  assert.doesNotMatch(r.reply, /Ovos|Arroz/);
  await c.send("Ovos");
  assert.equal(c.state().stage, "amount");
});
test("PDF2: validade explicita que alimentos vencem no período", async () => {
  const c = conversation([]);
  assert.match(
    (await c.send("o que vence neste mês?")).reply,
    /Alimentos que vencem/,
  );
});

 test("consumo: mensagem limpa e zero ou negativo sem alterar estoque", async () => {
 const c = conversation([item(1, "Bala", 500, "g")]);
 await c.send("Registrar consumo");
 assert.doesNotMatch((await c.send("Bala")).reply, /Exemplo/);
 for (const value of ["-100", "-100 g", "0", "0 g"]) {
   assert.equal((await c.send(value)).reply, "Informe uma quantidade maior que zero.");
   assert.equal(c.foods()[0].quantity, 500);
 }
 await c.send("100 g"); await c.send("Confirmar");
 assert.equal(c.foods()[0].quantity, 400);
 });

 test("cadastro: quantas unidades e validação clara de zero e negativos", async () => {
 const c=conversation([]);
 await c.send("Cadastrar alimento"); await c.send("banana prata");
 assert.match((await c.send("Unidades")).reply,/Quantas unidades/);
 for(const v of ["-100","-100 un","0"]) {
 assert.equal((await c.send(v)).reply,"Informe uma quantidade maior que zero.");
 assert.equal(c.state().field,"quantity"); assert.equal(c.foods().length,0);
 }
 await c.send("6"); await c.send("despensa"); await c.send("Não informar"); await c.send("Confirmar");
 assert.equal(c.foods()[0].quantity,6);
 });
 test("cadastro direto: quantidade negativa pede correção antes de confirmar",async()=>{
 const c=conversation([]); assert.equal((await c.send("cadastre -2 kg de arroz")).reply,"Informe uma quantidade maior que zero.");
 assert.equal(c.state().field,"quantity"); assert.equal(c.foods().length,0);
 });
