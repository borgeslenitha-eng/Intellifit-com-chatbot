import { normalize as n, unit, parseDate, today } from "./validation";
export const numericWords: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  meio: 0.5,
  meia: 0.5,
};
export function amount(text: string) {
  const t = n(text);
  const m = t.match(
    /(?:^|\s)(-?\d+(?:[.,]\d+)?|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|meio|meia)\s*(quilogramas?|quilos?|kg|gramas?|g|mililitros?|ml|litros?|l|unidades?|un)?(?=\s|$|[,.])/,
  );
  if (!m) return null;
  return {
    q: numericWords[m[1]] ?? Number(m[1].replace(",", ".")),
    u: m[2] ? unit(m[2]) : null,
    raw: m[0].trim(),
  };
}
export function formatQuantity(q: number, u: string) {
  if (u === "kg" && q > 0 && q < 1) {
    q *= 1000;
    u = "g";
  }
  if (u === "l" && q > 0 && q < 1) {
    q *= 1000;
    u = "ml";
  }
  return `${Number(q.toFixed(2)).toLocaleString("pt-BR")} ${u}`;
}
const singular = (word: string) =>
  ({
    ovos: "ovo",
    paes: "pao",
    graos: "grao",
    tomates: "tomate",
    bananas: "banana",
    macas: "maca",
    cenouras: "cenoura",
    batatas: "batata",
    queijos: "queijo",
    carnes: "carne",
  })[word] ??
  (word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word);
export function foodKey(name: string) {
  return n(name)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singular)
    .join(" ");
}
export function findFoods(text: string, foods: any[]) {
  const id = text.match(/^#(\d+)/);
  if (id) return foods.filter((f) => f.id === Number(id[1]));
  const key = foodKey(text);
  const exact = foods.filter((f) => foodKey(f.name) === key);
  if (exact.length) return exact;
  return foods.filter((f) => {
    const name = foodKey(f.name);
    return ` ${key} `.includes(` ${name} `) || ` ${name} `.includes(` ${key} `);
  });
}
export function extractName(text: string) {
  let s = n(text).replace(
    /^(?:por favor[, ]+)?(?:coloque|comprei|comprar|cadastre|cadastrar|cadastro|adicione|adicionar|adiciona|inclua|incluir|registre|registrar|repor|repus|usei|consumi|comi|bebi|gastei|descontar|desconte|retirei|retirar|baixar|editar|edite|alterar|altere|excluir|exclua|remover|remova|joguei fora)\s*/,
    "",
  );
  s = s.replace(/^(?:na|no)\s+(?:despensa|geladeira|freezer)\s+/, "");
  s = s.replace(/^mais\s+/, "");
  s = s.replace(/^(?:um |uma )?alimento(?: novo)?$/, "");
  const a = amount(s);
  if (a && s.startsWith(a.raw))
    s = s
      .slice(a.raw.length)
      .trim()
      .replace(/^de\s+/, "");
  return s
    .split(
      /,|\s+vence\b|\s+validade\b|\s+na geladeira\b|\s+no freezer\b|\s+na despensa\b/,
    )[0]
    .trim()
    .replace(/[?.!]$/, "");
}
export function parseFoodDate(
  text: string,
  base = today(),
): string | null | undefined {
  const s = n(text);
  if (
    /^(pular|nao informar|sem validade|nao sei|nao adicionar|depois|prefiro nao informar)$/.test(
      s,
    )
  )
    return null;
  if (s === "hoje") return base;
  if (s === "amanha") return addDays(base, 1);
  return parseDate(text) ?? undefined;
}
export function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const monthNames = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
export function expiryPeriod(
  text: string,
  base = today(),
): {
  start?: string;
  end?: string;
  label: string;
  unknown?: boolean;
  expired?: boolean;
  error?: boolean;
} {
  const t = n(text);
  const [year, month] = base.split("-").map(Number);
  if (/sem (?:data|validade)|nao informada/.test(t))
    return { label: "sem validade informada", unknown: true };
  if (/vencid|ja vence|passaram da validade/.test(t))
    return { label: "já vencidos", expired: true, end: addDays(base, -1) };
  const literal = t.match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/);
  if (literal) {
    const d = parseDate(literal[0]);
    return d
      ? { start: d, end: d, label: `em ${d.split("-").reverse().join("/")}` }
      : { label: "Data inválida. Informe DD/MM/AAAA.", error: true };
  }
  if (/amanha/.test(t))
    return { start: addDays(base, 1), end: addDays(base, 1), label: "amanhã" };
  if (/hoje/.test(t)) return { start: base, end: base, label: "hoje" };
  const number = t.match(
    /(?:proximos|daqui a|em)\s+(\d+|um|dois|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+dias?/,
  );
  if (number) {
    const count = numericWords[number[1]] ?? Number(number[1]);
    return /daqui a| em /.test(" " + t)
      ? {
          start: addDays(base, count),
          end: addDays(base, count),
          label: `daqui a ${count} dias`,
        }
      : {
          start: base,
          end: addDays(base, count),
          label: `nos próximos ${count} dias`,
        };
  }
  const explicit = monthNames.findIndex((m) =>
    new RegExp("\\b" + m + "\\b").test(t),
  );
  if (
    explicit >= 0 ||
    /mes (?:que vem|seguinte)|proximo mes|este mes|esse mes|neste mes|mes atual/.test(
      t,
    )
  ) {
    const y = t.match(/\b(20\d{2}|21\d{2})\b/);
    let targetYear = y ? Number(y[1]) : year;
    let targetMonth = explicit >= 0 ? explicit + 1 : month;
    if (explicit < 0 && /mes (?:que vem|seguinte)|proximo mes/.test(t)) {
      targetMonth++;
      if (targetMonth === 13) {
        targetMonth = 1;
        targetYear++;
      }
    }
    const start = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
    const next =
      targetMonth === 12
        ? `${targetYear + 1}-01-01`
        : `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-01`;
    return {
      start,
      end: addDays(next, -1),
      label: `em ${monthNames[targetMonth - 1]} de ${targetYear}`,
    };
  }
  if (/proximo ano|\bem 20\d{2}\b/.test(t)) {
    const y = t.match(/20\d{2}/);
    const target = y ? Number(y[0]) : year + 1;
    return {
      start: `${target}-01-01`,
      end: `${target}-12-31`,
      label: `em ${target}`,
    };
  }
  if (/semana que vem|proxima semana/.test(t)) {
    const day = new Date(base + "T12:00:00Z").getUTCDay();
    const monday = addDays(base, 8 - (day || 7));
    return {
      start: monday,
      end: addDays(monday, 6),
      label: "na próxima semana (segunda a domingo)",
    };
  }
  if (
    /semana|sete dias|7 dias|primeiro|logo|perto|prestes|validade|venc/.test(
      t,
    ) &&
    !/sexta|segunda|terca|quarta|quinta|sabado|domingo/.test(t)
  )
    return {
      start: base,
      end: addDays(base, 7),
      label: "de hoje até os próximos 7 dias",
    };
  return {
    label:
      "Qual período? Você pode dizer hoje, amanhã, próximo mês, um mês por nome ou uma data completa.",
    error: true,
  };
}
