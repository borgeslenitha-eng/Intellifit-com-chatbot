export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function dateOnly(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date)
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return String(value ?? "").slice(0, 10);
}
export function parseDate(value: string): string | null {
  let s = value.trim();
  if (/^\d{8}$/.test(s)) s = `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}`;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) s = `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T12:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}
export function unit(value: string): string | null {
  const s = normalize(value);
  const aliases: Record<string, string> = {
    g: "g",
    grama: "g",
    gramas: "g",
    kg: "kg",
    quilo: "kg",
    quilos: "kg",
    quilograma: "kg",
    quilogramas: "kg",
    ml: "ml",
    mililitro: "ml",
    mililitros: "ml",
    l: "l",
    litro: "l",
    litros: "l",
    un: "un",
    unidade: "un",
    unidades: "un",
    ovo: "un",
    ovos: "un",
  };
  return aliases[s] ?? null;
}
export function convert(q: number, from: string, to: string): number | null {
  if (from === to) return q;
  const dims: Record<string, [string, number]> = {
    g: ["mass", 1],
    kg: ["mass", 1000],
    ml: ["volume", 1],
    l: ["volume", 1000],
  };
  return dims[from] && dims[to] && dims[from][0] === dims[to][0]
    ? (q * dims[from][1]) / dims[to][1]
    : null;
}
export function validateFood(f: any, allowZero = false) {
  if (!f || typeof f !== "object")
    throw new Error("Informe os dados do alimento.");
  if (f.expirationDate === undefined || f.expirationDate === "")
    f.expirationDate = null;
  for (const [key, max] of Object.entries({
    name: 100,
    category: 50,
    unit: 30,
    storageLocation: 30,
  }))
    if (typeof f[key] !== "string" || !f[key].trim() || f[key].length > max)
      throw new Error(`Campo ${key} inválido.`);
  if (
    typeof f.quantity !== "number" ||
    !Number.isFinite(f.quantity) ||
    f.quantity < (allowZero ? 0 : 0.01) ||
    f.quantity > 99999999.99 ||
    Math.abs(f.quantity * 100 - Math.round(f.quantity * 100)) > 0.00001
  )
    throw new Error(
      "Quantidade inválida: use até duas casas decimais e um valor positivo.",
    );
  if (
    f.expirationDate !== null &&
    (typeof f.expirationDate !== "string" || !parseDate(f.expirationDate))
  )
    throw new Error(
      "Validade inválida. Use uma data real no formato AAAA-MM-DD.",
    );
  if (f.expirationDate) {
    f.expirationDate = parseDate(f.expirationDate);
    if (!allowZero && f.expirationDate < today())
      throw new Error("A validade não pode ser anterior a hoje.");
  }
  if (!unit(f.unit)) throw new Error("Unidades aceitas: g, kg, ml, l e un.");
  if (
    !["despensa", "geladeira", "freezer"].includes(normalize(f.storageLocation))
  )
    throw new Error("Local: despensa, geladeira ou freezer.");
  f.name = f.name.trim();
  f.category = f.category.trim();
  f.unit = unit(f.unit);
  f.storageLocation = normalize(f.storageLocation);
}
export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
export const daysLeft = (date: string | null) =>
  date == null
    ? Number.NaN
    : Math.round(
        (Date.parse(dateOnly(date) + "T12:00:00Z") -
          Date.parse(today() + "T12:00:00Z")) /
          86400000,
      );
