import {
  normalize as n,
  unit,
  convert,
  validateFood,
  today,
  daysLeft,
} from "./validation";
import { suggest } from "./recipes";
import { classify } from "../ml/classifier";
import {
  amount,
  findFoods,
  extractName,
  formatQuantity,
  parseFoodDate,
  expiryPeriod,
  foodKey,
} from "./language";
export interface Store {
  list(): Promise<any[]>;
  create(f: any): Promise<any>;
  update(id: number, f: any): Promise<any>;
  remove(id: number): Promise<void>;
}
export type Result = {
  reply: string;
  state: any;
  changed?: boolean;
  actions?: string[];
  recognition?: any;
};
const home = [
  "O que tenho na geladeira?",
  "O que vence neste mês?",
  "Cadastrar alimento",
  "Registrar consumo",
  "Sugerir receitas",
  "Resumo do estoque",
];
const fields = [
  "name",
  "unit",
  "quantity",
  "storageLocation",
  "expirationDate",
];
const questions: Record<string, string> = {
  name: "Qual alimento você quer cadastrar?",
  unit: "Como você quer medir esse alimento?",
  storageLocation: "Onde você guarda esse alimento?",
  expirationDate:
    "Qual é a validade? Use DD/MM/AAAA, hoje ou amanhã. Você também pode escolher Não informar.",
};
const actionsFor: Record<string, string[]> = {
  unit: ["Gramas", "Quilogramas", "Mililitros", "Litros", "Unidades"],
  storageLocation: ["despensa", "geladeira", "freezer"],
  expirationDate: ["Hoje", "Amanhã", "Não informar"],
};
const dateLabel = (d: string | null) =>
  d ? d.split("-").reverse().join("/") : "Não informada";
export const detail = (f: any) =>
  `**${f.name}**\nQuantidade: ${formatQuantity(f.quantity, f.unit)} · ${f.storageLocation}\nValidade: ${dateLabel(f.expirationDate)}`;
const reply = (s: string, actions = home): Result => ({
  reply: s,
  state: {},
  actions,
});
const cancel = () => reply("Operação cancelada. O estoque não foi alterado.");
const help = () =>
  reply(
    "Posso consultar seu estoque, conferir validades, registrar compras e consumo, editar alimentos e sugerir receitas.\n\nExperimente: “comprei dois ovos”, “usei 200 g de arroz”, “o que vence mês que vem?” ou apenas o nome de um alimento.\n\nVocê pode mudar de pedido durante a conversa ou enviar “cancelar”.",
  );
const commandMap: Record<string, string> = {
  "cadastrar alimento": "cadastrar",
  "registrar consumo": "consumir",
  "usei um alimento": "consumir",
  "editar alimento": "editar",
  "excluir alimento": "excluir",
  "sugerir receitas": "receitas",
  "resumo do estoque": "resumo",
  ajuda: "ajuda",
  menu: "ajuda",
  geladeira: "consultar",
  despensa: "consultar",
  freezer: "consultar",
};
function recognize(text: string) {
  const t = n(text);
  const prediction = classify(text);
  if (commandMap[t])
    return { intent: commandMap[t], source: "command", confidence: 1 };
  if (
    /^(?:liste|listar|mostre|mostrar|me fale|quais sao)\b.*\balimentos\b/.test(
      t,
    )
  )
    return { intent: "consultar", source: "rule", confidence: 1 };
  if (
    /^coloque\b/.test(t) ||
    (/^\d/.test(t) && amount(text) && /[a-z]/.test(extractName(text)))
  )
    return { intent: "cadastrar", source: "rule", confidence: 1 };
  // Explicit actions are deterministic safeguards; ML handles other phrasings.
  const rules: [RegExp, string][] = [
    [
      /^(comprei|cadastre|cadastrar|adicione|adicionar|inclua|incluir|repus|repor)\b/,
      "cadastrar",
    ],
    [
      /^(usei|consumi|comi|bebi|gastei|dar baixa|baixar|descontar|desconte)\b/,
      "consumir",
    ],
    [/^(editar|edite|alterar|altere|corrigir|mudar|atualizar)\b/, "editar"],
    [/^(excluir|exclua|remover|remova|joguei|descartar)\b/, "excluir"],
  ];
  for (const [re, intent] of rules)
    if (re.test(t)) return { intent, source: "rule", confidence: 1 };
  if (!prediction.accepted) {
    if (
      /receita|cozinhar|preparar|prato|jantar|almoco/.test(t) &&
      !/remedio|medic|antibiotico/.test(t)
    )
      return { intent: "receitas", source: "rule", confidence: 1 };
    if (/venc|validade/.test(t))
      return { intent: "validade", source: "rule", confidence: 1 };
    if (/estoque|tenho|geladeira|despensa|freezer|listar alimentos/.test(t))
      return { intent: "consultar", source: "rule", confidence: 1 };
  }
  return {
    intent: prediction.accepted ? prediction.intent : "incerto",
    source: "ml",
    confidence: prediction.confidence,
    alternatives: prediction.ranking.slice(0, 3),
  };
}
function fieldValue(field: string, text: string) {
  if (field === "quantity") {
    const a = amount(text);
    return a &&
      a.q > 0 &&
      a.q <= 99999999.99 &&
      Math.abs(a.q * 100 - Math.round(a.q * 100)) < 0.000001
      ? a.q
      : undefined;
  }
  if (field === "unit") return unit(text) ?? undefined;
  if (field === "expirationDate") return parseFoodDate(text);
  if (field === "storageLocation")
    return ["despensa", "geladeira", "freezer"].includes(n(text))
      ? n(text)
      : undefined;
  return text.trim() && text.length <= (field === "name" ? 100 : 50)
    ? text.trim()
    : undefined;
}
function question(field: string, food: any = {}) {
  if (field !== "quantity") return questions[field];
  const labels: Record<string, string> = {
    g: "gramas",
    kg: "quilogramas",
    ml: "mililitros",
    l: "litros",
    un: "unidades",
  };
  return `${food.unit === "un" ? "Quantas" : "Quantos"} ${labels[food.unit] ?? "itens"} de **${food.name ?? "esse alimento"}** você quer cadastrar?`;
}
function nextField(state: any): Result {
  state = { ...state, food: { category: "Outros", ...state.food } };
  if (
    state.food.expirationDate &&
    state.food.expirationDate < today() &&
    (state.mode === "create" ||
      state.food.expirationDate !== state.snapshot?.expirationDate)
  ) {
    state.food.expirationDate = undefined;
    return {
      reply: "A validade não pode ser anterior a hoje. Qual é a validade?",
      state: { ...state, stage: "field", field: "expirationDate" },
      actions: actionsFor.expirationDate,
    };
  }
  if (state.food.quantity !== undefined && state.food.quantity <= 0) {
    state.food.quantity = undefined;
    return {reply: "Informe uma quantidade maior que zero.", state: {...state, stage: "field", field: "quantity"}, actions: ["Cancelar"]};
  }
  const field = fields.find((k) => state.food[k] === undefined);
  if (field)
    return {
      reply: question(field, state.food),
      state: { ...state, stage: "field", field },
      actions: actionsFor[field],
    };
  return {
    reply: `Confirma ${state.mode === "create" ? "o cadastro" : "a alteração"}?\n\n${detail(state.food)}`,
    state: { ...state, stage: "confirm" },
    actions: ["Confirmar", "Cancelar"],
  };
}
function choose(
  state: any,
  foods: any[],
  prefix = "Qual destes alimentos?",
): Result {
  if (!foods.length)
    return {
      reply:
        "Qual alimento? Digite o nome cadastrado ou cancele para começar outro pedido.",
      state: { ...state, stage: "target" },
      actions: ["Cancelar"],
    };
  const choices = foods.slice(0, 20);
  return {
    reply:
      prefix +
      "\n\n" +
      choices.map((f, i) => `${i + 1}. ${detail(f)}`).join("\n\n") +
      "\n\nToque em uma opção ou digite o número dela.",
    state: { ...state, stage: "select", choiceIds: choices.map((f) => f.id) },
    actions: choices.map(
      (f, i) =>
        `${i + 1}. ${f.name} · ${formatQuantity(f.quantity, f.unit)} · ${f.storageLocation} · ${dateLabel(f.expirationDate)}`,
    ),
  };
}
function foodMenu(f: any): Result {
  return {
    reply: detail(f) + "\n\nO que deseja fazer com esse alimento?",
    state: { stage: "foodMenu", id: f.id },
    actions: [
      "Adicionar quantidade",
      "Registrar consumo",
      "Editar alimento",
      "Excluir alimento",
      "Cancelar",
    ],
  };
}
function newFood(text: string) {
  const a = amount(text);
  const dt = text.match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/);
  const loc = n(text).match(/\b(despensa|geladeira|freezer)\b/);
  const name = extractName(text);
  const food: any = {};
  if (
    /^(comprei|cadastre|cadastrar|adicione|adicionar|inclua|incluir|repus|repor|coloque)\b/.test(
      n(text),
    ) ||
    /^\d/.test(n(text))
  ) {
    if (
      name &&
      !/^(alimento|outro lote|quantidade|mais|um alimento)$/.test(name)
    )
      food.name = name;
  }
  if (a) food.quantity = a.q;
  if (a?.u) food.unit = a.u;
  if (loc) food.storageLocation = loc[1];
  if (dt) food.expirationDate = parseFoodDate(dt[0]);
  if (/vence amanha/.test(n(text)))
    food.expirationDate = parseFoodDate("amanhã");
  if (/vence hoje/.test(n(text))) food.expirationDate = today();
  if (/sem validade|nao informar/.test(n(text))) food.expirationDate = null;
  return food;
}
function purchaseChoice(state: any, f: any): Result {
  const draft = state.food ?? {};
  const different =
    (draft.expirationDate !== undefined &&
      draft.expirationDate !== f.expirationDate) ||
    (draft.storageLocation && draft.storageLocation !== f.storageLocation);
  if (different)
    return {
      ...nextField({
        mode: "create",
        food: {
          ...draft,
          name: draft.name ?? f.name,
          category: f.category,
          unit: draft.unit ?? f.unit,
          storageLocation: draft.storageLocation ?? f.storageLocation,
        },
      }),
      reply:
        "A validade ou o local são diferentes. Vamos cadastrar outro lote.\n\n" +
        nextField({
          mode: "create",
          food: {
            ...draft,
            name: draft.name ?? f.name,
            category: f.category,
            unit: draft.unit ?? f.unit,
            storageLocation: draft.storageLocation ?? f.storageLocation,
          },
        }).reply,
    };
  return {
    reply: `Você já tem este alimento:\n\n${detail(f)}\n\nA nova compra tem a mesma validade e fica no mesmo local? Você pode somar ao mesmo lote ou cadastrar outro separadamente.`,
    state: {
      ...state,
      mode: "purchase",
      stage: "purchaseChoice",
      id: f.id,
      snapshot: f,
    },
    actions: ["Somar ao mesmo lote", "Cadastrar outro lote", "Cancelar"],
  };
}
function quantityStep(state: any, f: any): Result {
  const a = state.amount;
  if (!a)
    return {
      reply: `Quanto você ${state.mode === "restock" ? "comprou de" : "usou de"} **${f.name}**? Você tem ${formatQuantity(f.quantity, f.unit)}.`,
      state: { ...state, id: f.id, snapshot: f, stage: "amount" },
      actions: ["Cancelar"],
    };
  if (a.q <= 0)
    return {reply: "Informe uma quantidade maior que zero.", state: {...state, id: f.id, snapshot: f, amount: null, stage: "amount"}, actions: ["Cancelar"]};
  if (!a.u)
    return {
      reply: `Você quis dizer ${formatQuantity(a.q, f.unit)} de ${f.name}? Se usou outra unidade, escolha abaixo.`,
      state: { ...state, id: f.id, snapshot: f, stage: "consumeUnit" },
      actions: [
        f.unit,
        ...["g", "kg", "ml", "l", "un"].filter((u) => u !== f.unit),
        "Cancelar",
      ],
    };
  const q = convert(a.q, a.u, unit(f.unit) ?? f.unit);
  if (q === null)
    return {
      reply: `Esse alimento está cadastrado em ${f.unit}. Informe quanto ${state.mode === "restock" ? "adicionou" : "usou"} em uma unidade compatível.`,
      state: { ...state, id: f.id, snapshot: f, amount: null, stage: "amount" },
      actions: ["Cancelar"],
    };
  if (
    q <= 0 ||
    !Number.isFinite(q) ||
    (state.mode !== "restock" && q > f.quantity)
  )
    return {
      reply: `Você tem ${formatQuantity(f.quantity, f.unit)}. Informe uma quantidade maior que zero${state.mode !== "restock" ? " e que não ultrapasse o estoque" : ""}.`,
      state: { ...state, id: f.id, snapshot: f, amount: null, stage: "amount" },
      actions: ["Cancelar"],
    };
  const remaining = f.quantity + (state.mode === "restock" ? q : -q);
  if (
    remaining > 99999999.99 ||
    Math.abs(remaining * 100 - Math.round(remaining * 100)) > 0.00001
  )
    return {
      reply:
        "Essa quantidade não cabe na precisão do cadastro (duas casas decimais). Informe outro valor.",
      state: { ...state, id: f.id, snapshot: f, amount: null, stage: "amount" },
      actions: ["Cancelar"],
    };
  return {
    reply: `${state.mode === "restock" ? "Adicionar" : "Registrar o consumo de"} **${formatQuantity(q, f.unit)} de ${f.name}**?\n\nAntes: ${formatQuantity(f.quantity, f.unit)}\nDepois: **${formatQuantity(remaining, f.unit)}**`,
    state: { ...state, id: f.id, snapshot: f, stage: "confirm", remaining },
    actions: ["Confirmar", "Cancelar"],
  };
}
function pick(state: any, f: any): Result {
  if (state.mode === "menu") return foodMenu(f);
  if (state.mode === "purchase") return purchaseChoice(state, f);
  if (state.mode === "consume" || state.mode === "restock") {
    let a = state.amount;
    if (a && !a.u && f.unit === "un") a = { ...a, u: "un" };
    return quantityStep({ ...state, amount: a }, f);
  }
  if (state.mode === "delete")
    return {
      reply: `Excluir este cadastro?\n\n${detail(f)}`,
      state: { ...state, id: f.id, snapshot: f, stage: "confirm" },
      actions: ["Confirmar", "Cancelar"],
    };
  return {
    reply: `O que deseja alterar em **${f.name}**?`,
    state: {
      ...state,
      id: f.id,
      snapshot: f,
      food: { ...f },
      stage: "editField",
    },
    actions: ["Nome", "Quantidade", "Unidade", "Local", "Validade", "Cancelar"],
  };
}
async function core(
  text: string,
  state: any,
  store: Store,
  rec: any,
): Promise<Result> {
  const t = n(text);
  if (["cancelar", "cancela", "nao", "não"].includes(t)) return cancel();
  if (["ajuda", "menu", "oi", "ola"].includes(t)) return help();
  if (state.stage === "field" && state.field === "quantity") {
    const a = amount(text);
    if (a && a.q <= 0) return {reply: "Informe uma quantidade maior que zero.", state, actions: ["Cancelar"]};
  }
  const foods = await store.list();
  if (!state.stage && ["confirmar", "sim", "confirmo"].includes(t))
    return reply("Não há nenhuma alteração aguardando confirmação.");
  // A new explicit request interrupts an unfinished operation, without applying it.
  const isReply =
    (state.stage === "confirm" &&
      ["confirmar", "sim", "confirmo"].includes(t)) ||
    (state.stage === "purchaseChoice" &&
      ["somar ao mesmo lote", "cadastrar outro lote"].includes(t)) ||
    (state.stage === "foodMenu" &&
      [
        "adicionar quantidade",
        "registrar consumo",
        "editar alimento",
        "excluir alimento",
      ].includes(t)) ||
    (state.stage === "select" && /^(?:\d+[.)]?|#\d+)/.test(text));
  const validField =
    state.stage === "field" && fieldValue(state.field, text) !== undefined;
  const newRequest =
    !!state.stage &&
    !isReply &&
    rec.intent !== "incerto" &&
    rec.intent !== "fora_escopo" &&
    (rec.source === "rule" ||
      rec.source === "command" ||
      (text.split(/\s+/).length >= 3 && rec.confidence >= 0.55)) &&
    !(
      validField &&
      ["unit", "quantity", "storageLocation", "expirationDate"].includes(
        state.field,
      )
    );
  if (newRequest) {
    const result = await core(text, {}, store, rec);
    return {
      ...result,
      reply:
        "Certo, deixei o pedido anterior de lado sem alterar o estoque.\n\n" +
        result.reply,
    };
  }
  if (state.stage === "confirm") {
    if (!["sim", "confirmar", "confirmo"].includes(t))
      return {
        reply:
          "Escolha Confirmar ou Cancelar. Também pode enviar um novo pedido.",
        state,
        actions: ["Confirmar", "Cancelar"],
      };
    if (state.mode === "create") {
      if (state.food.expirationDate && state.food.expirationDate < today())
        return nextField(state);
      validateFood(state.food);
      await store.create(state.food);
      return {
        ...reply("Alimento cadastrado.\n\n" + detail(state.food)),
        changed: true,
      };
    }
    const f = foods.find((f) => f.id === state.id);
    if (!f || ["id", ...fields].some((k) => f[k] !== state.snapshot[k]))
      return reply(
        "Esse alimento foi alterado ou excluído enquanto conversávamos. Envie o pedido novamente para usar os dados atuais.",
      );
    if (state.mode === "delete") await store.remove(f.id);
    else {
      const next = ["consume", "restock"].includes(state.mode)
        ? { ...f, quantity: state.remaining }
        : state.food;
      validateFood(next, true);
      await store.update(f.id, next);
    }
    return {
      ...reply(
        state.mode === "delete"
          ? `${f.name} foi excluído.`
          : state.mode === "consume" || state.mode === "restock"
            ? `**${state.mode === "consume" ? "Consumo registrado" : "Compra adicionada"}!**\n${f.name} agora tem **${formatQuantity(state.remaining, f.unit)}**.`
            : `Alimento atualizado.\n\n${detail(state.food)}`,
      ),
      changed: true,
    };
  }
  if (state.stage === "field") {
    const v = fieldValue(state.field, text);
    if (v === undefined)
      return {
        reply: "Não entendi esse valor. " + question(state.field, state.food),
        state,
        actions: actionsFor[state.field],
      };
    const draft = { ...state.food, [state.field]: v };
    if (state.field === "quantity") {
      const a = amount(text);
      if (a?.u) draft.unit = a.u;
    }
    if (state.mode === "create" && state.field === "name") {
      const found = findFoods(text, foods);
      if (found.length === 1)
        return purchaseChoice({ mode: "purchase", food: draft }, found[0]);
      if (found.length > 1)
        return choose({ mode: "purchase", food: draft }, found);
    }
    return nextField({ ...state, food: draft });
  }
  if (state.stage === "editField") {
    const map: Record<string, string> = {
      nome: "name",
      quantidade: "quantity",
      unidade: "unit",
      local: "storageLocation",
      validade: "expirationDate",
    };
    const field = map[t];
    if (!field)
      return {
        reply: "Escolha o campo que deseja alterar.",
        state,
        actions: [
          "Nome",
          "Quantidade",
          "Unidade",
          "Local",
          "Validade",
          "Cancelar",
        ],
      };
    return {
      reply: question(field, state.food),
      state: { ...state, stage: "field", field },
      actions: actionsFor[field],
    };
  }
  if (state.stage === "select" || state.stage === "target") {
    const index = text.match(/^(\d+)(?:[.)]|$)/);
    const f =
      index && state.choiceIds
        ? foods.find((f) => f.id === state.choiceIds[Number(index[1]) - 1])
        : null;
    const found = f ? [f] : findFoods(text, foods);
    if (found.length === 1) return pick(state, found[0]);
    return choose(
      state,
      found,
      found.length
        ? "Qual destes alimentos?"
        : "Não localizei esse nome. Escolha um alimento abaixo:",
    );
  }
  if (state.stage === "foodMenu") {
    const f = foods.find((f) => f.id === state.id);
    if (!f) return reply("Esse alimento já foi removido.");
    if (t === "adicionar quantidade")
      return purchaseChoice({ mode: "purchase", food: { name: f.name } }, f);
    if (t === "registrar consumo") return pick({ mode: "consume" }, f);
    if (t === "editar alimento") return pick({ mode: "edit" }, f);
    if (t === "excluir alimento") return pick({ mode: "delete" }, f);
    return foodMenu(f);
  }
  if (state.stage === "purchaseChoice") {
    const f = foods.find((f) => f.id === state.id);
    if (!f || fields.some((k) => f[k] !== state.snapshot[k]))
      return reply(
        "O cadastro mudou. Envie sua compra novamente para conferir o lote atual.",
      );
    if (t === "somar ao mesmo lote")
      return pick(
        {
          mode: "restock",
          amount:
            state.food.quantity !== undefined
              ? { q: state.food.quantity, u: state.food.unit ?? f.unit }
              : null,
        },
        f,
      );
    if (t === "cadastrar outro lote")
      return nextField({
        mode: "create",
        food: {
          name: f.name,
          category: f.category,
          unit: f.unit,
          storageLocation: f.storageLocation,
          ...state.food,
        },
      });
    return purchaseChoice(state, f);
  }
  if (state.stage === "amount" || state.stage === "consumeUnit") {
    const f = foods.find((f) => f.id === state.id);
    if (!f) return reply("O alimento foi excluído.");
    const a =
      state.stage === "consumeUnit"
        ? { ...state.amount, u: unit(text) }
        : amount(text);
    if (!a || (state.stage === "consumeUnit" && !a.u))
      return {
        reply: "Informe a quantidade e a unidade.",
        state,
        actions: ["Cancelar"],
      };
    return pick({ ...state, amount: a }, f);
  }
  // Bare names are handled as an explicit question rather than guessed as a write intent.
  const exact = foods.filter((f) => foodKey(f.name) === foodKey(text));
  if (exact.length === 1) return foodMenu(exact[0]);
  if (exact.length > 1) return choose({ mode: "menu" }, exact);
  if (/^nao\b/.test(t))
    return reply(
      "Não vou fazer essa alteração. Diga o que você gostaria de consultar ou modificar.",
    );
  if (rec.intent === "ajuda") return help();
  if (rec.intent === "cadastrar") {
    const draft = newFood(text);
    const found = draft.name ? findFoods(draft.name, foods) : [];
    if (found.length === 1)
      return purchaseChoice({ mode: "purchase", food: draft }, found[0]);
    if (found.length > 1)
      return choose({ mode: "purchase", food: draft }, found);
    return nextField({ mode: "create", food: draft });
  }
  if (["consumir", "editar", "excluir"].includes(rec.intent)) {
    const mode =
      rec.intent === "consumir"
        ? "consume"
        : rec.intent === "editar"
          ? "edit"
          : "delete";
    const next = {
      mode,
      amount:
        mode === "consume" &&
        !/^(usei um alimento|registrar consumo|dar baixa no estoque)$/.test(t)
          ? amount(text)
          : null,
    };
    let found = findFoods(text, foods);
    if (!found.length) found = findFoods(extractName(text), foods);
    if (found.length === 1) return pick(next, found[0]);
    return choose(next, found);
  }
  if (rec.intent === "receitas")
    return reply(suggest(foods, /vence|vencer|primeiro|aproveit/.test(t)));
  if (rec.intent === "resumo")
    return reply(
      `**Resumo da sua cozinha**\n\nTotal de cadastros: **${foods.length}**\nCom saldo e validade informada em dia: **${foods.filter((f) => f.quantity > 0 && f.expirationDate && daysLeft(f.expirationDate) >= 0).length}**\nVencidos com saldo: **${foods.filter((f) => f.quantity > 0 && daysLeft(f.expirationDate) < 0).length}**\nVencem em até 7 dias: **${foods.filter((f) => f.quantity > 0 && daysLeft(f.expirationDate) >= 0 && daysLeft(f.expirationDate) <= 7).length}**\nSem validade informada: **${foods.filter((f) => !f.expirationDate).length}**\nSem saldo: **${foods.filter((f) => f.quantity === 0).length}**\n\n**Por local**\n` +
        ["despensa", "geladeira", "freezer"]
          .map(
            (l) =>
              `${l}: ${foods.filter((f) => n(f.storageLocation) === l).length} cadastros`,
          )
          .join("\n"),
    );
  if (rec.intent === "validade") {
    const period = expiryPeriod(text);
    if (period.error)
      return reply(period.label, [
        "O que vence hoje?",
        "O que vence amanhã?",
        "O que vence no próximo mês?",
      ]);
    const named = findFoods(text, foods);
    const base = named.length ? named : foods;
    const selected = base.filter(
      (f) =>
        f.quantity > 0 &&
        (period.unknown
          ? !f.expirationDate
          : f.expirationDate &&
            (!period.start || f.expirationDate >= period.start) &&
            (!period.end || f.expirationDate <= period.end)),
    );
    return reply(
      `**Alimentos ${period.unknown || period.expired ? "" : "que vencem "}${period.label}**\n\n` +
        (selected.length
          ? selected.map(detail).join("\n\n")
          : "Nenhum alimento com saldo encontrado nesse período."),
      home,
    );
  }
  if (rec.intent === "consultar") {
    const loc = t.match(/geladeira|despensa|freezer/);
    let selected = loc
      ? foods.filter((f) => n(f.storageLocation) === loc[0])
      : foods;
    const found = findFoods(text, selected);
    if (found.length) selected = found;
    else if (
      /^(tenho|tem|buscar|procurar|ainda tenho|ainda tem)\s+/.test(t) &&
      !loc &&
      !/alimento|estoque/.test(t)
    )
      selected = [];
    if (!selected.length) {
      const name = extractName(
        text.replace(/^(?:ainda )?(?:tenho|tem|buscar|procurar)\s+/i, ""),
      );
      return {
        reply: `Não encontrei **${name}** no estoque. Quer cadastrar esse alimento?`,
        state: { stage: "offerCreate", name },
        actions: ["Cadastrar este alimento", "Cancelar"],
      };
    }
    return reply(
      selected.length
        ? "**Seu estoque" +
            (loc ? " · " + loc[0] : "") +
            "**\n\n" +
            selected.map(detail).join("\n\n")
        : "Não encontrei esse alimento no estoque. Quer cadastrar?",
      selected.length ? home : ["Cadastrar alimento", "Listar alimentos"],
    );
  }
  if (
    /^[a-zA-ZÀ-ÿ -]{2,60}$/.test(text) &&
    text.split(/\s+/).length <= 3 &&
    !["fora_escopo", "ajuda"].includes(rec.intent)
  )
    return {
      reply: `Não encontrei **${text}** no estoque. Quer cadastrar esse alimento?`,
      state: { stage: "offerCreate", name: text },
      actions: ["Cadastrar este alimento", "Cancelar"],
    };
  return reply(
    "Fiquei em dúvida sobre o pedido. Posso ajudar com alimentos, compras, consumo, validade e receitas. Escolha uma opção ou explique de outra forma.",
  );
}
export async function respond(
  text: string,
  state: any,
  store: Store,
): Promise<Result> {
  text = text.trim();
  const rec = recognize(text);
  if (
    state.stage === "offerCreate" &&
    [
      "cadastrar este alimento",
      "sim",
      "quero",
      "pode cadastrar",
      "cadastrar alimento",
    ].includes(n(text))
  )
    return {
      ...nextField({ mode: "create", food: { name: state.name } }),
      recognition: { source: "dialogue", intent: "cadastrar" },
    };
  return { ...(await core(text, state, store, rec)), recognition: rec };
}
