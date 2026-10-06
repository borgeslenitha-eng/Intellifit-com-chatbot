import { normalize, daysLeft } from "./validation";
export const recipes = [
  {
    name: "Macarrão ao molho de tomate",
    ingredients: ["macarrao", "molho de tomate"],
    steps:
      "Cozinhe o macarrão até ficar macio. Aqueça o molho de tomate, junte a massa e misture. Ajuste os temperos.",
  },
  {
    name: "Ovos ao molho de tomate",
    ingredients: ["ovo", "molho de tomate"],
    steps:
      "Aqueça o molho em uma frigideira. Abra os ovos sobre o molho, tampe e cozinhe até claras e gemas ficarem firmes.",
  },
  {
    name: "Arroz com feijão",
    ingredients: ["arroz", "feijao"],
    steps:
      "Cozinhe o arroz e o feijão separadamente até ficarem macios. Tempere e sirva juntos.",
  },
  {
    name: "Mingau de aveia",
    ingredients: ["aveia", "leite"],
    steps:
      "Misture a aveia ao leite e aqueça em fogo baixo, mexendo até engrossar. Ajuste a consistência com mais leite.",
  },
  {
    name: "Omelete de queijo",
    ingredients: ["ovo", "queijo"],
    steps:
      "Bata os ovos, acrescente o queijo picado e cozinhe em frigideira untada. Vire ou tampe até o ovo ficar completamente firme.",
  },
  {
    name: "Batata com cenoura assada",
    ingredients: ["batata", "cenoura"],
    steps:
      "Corte os legumes em pedaços semelhantes, tempere, unte levemente e asse até ficarem macios e dourados.",
  },

  {
    name: "Omelete de tomate",
    ingredients: ["ovo", "tomate"],
    steps:
      "Bata os ovos. Pique o tomate, misture e cozinhe em frigideira untada até o ovo ficar completamente firme.",
  },
  {
    name: "Panqueca de banana",
    ingredients: ["banana", "ovo", "aveia"],
    steps:
      "Amasse a banana, misture com ovo e aveia. Faça pequenas porções em frigideira untada e cozinhe dos dois lados até firmarem.",
  },
  {
    name: "Arroz com cenoura",
    ingredients: ["arroz", "cenoura"],
    steps:
      "Rale a cenoura. Refogue, acrescente arroz e água e cozinhe até o arroz ficar macio. Ajuste os temperos.",
  },
  {
    name: "Macarrão com tomate",
    ingredients: ["macarrao", "tomate"],
    steps:
      "Cozinhe o macarrão em água. Cozinhe o tomate picado com um pouco de água até formar molho. Misture e tempere.",
  },
  {
    name: "Frango com legumes",
    ingredients: ["frango", "cenoura", "batata"],
    steps:
      "Corte os ingredientes. Cozinhe o frango completamente e acrescente os legumes, água e temperos. Cozinhe até ficarem macios.",
  },
  {
    name: "Sanduíche de queijo e tomate",
    ingredients: ["pao", "queijo", "tomate"],
    steps:
      "Fatie o tomate, monte o sanduíche com queijo e aqueça até o queijo derreter, se desejar.",
  },
  {
    name: "Salada de grão-de-bico",
    ingredients: ["grao-de-bico", "tomate", "cenoura"],
    steps:
      "Use grão-de-bico já cozido. Misture ao tomate picado e à cenoura ralada. Tempere a gosto.",
  },
  {
    name: "Vitamina de banana",
    ingredients: ["banana", "leite", "aveia"],
    steps:
      "Bata os ingredientes no liquidificador até obter a textura desejada. Sirva em seguida.",
  },
  {
    name: "Purê de batata",
    ingredients: ["batata", "leite"],
    steps:
      "Cozinhe as batatas até ficarem macias, amasse e adicione leite aos poucos, aquecendo e mexendo até obter um purê.",
  },
];
export function suggest(foods: any[], prioritize = false) {
  const available = foods.filter(
    (f) =>
      f.quantity > 0 && (!f.expirationDate || daysLeft(f.expirationDate) >= 0),
  );
  const aliases: Record<string, RegExp> = {
    ovo: /^ovos?(?: de galinha| branco| brancos| caipira| caipiras)?$/,
    tomate: /^tomates?(?: cereja| italiano| maduros?)?$/,
    "molho de tomate": /^molho de tomate(?: tradicional)?$/,
    arroz: /^arroz(?: integral| branco| parboilizado)?$/,
    feijao: /^feijao(?: preto| carioca| branco| cozido)?$/,
    macarrao: /^(macarrao(?: integral| espaguete)?|espaguete|penne)$/,
    leite: /^leite(?: integral| desnatado| semidesnatado| sem lactose)?$/,
    pao: /^(pao(?: de forma| integral| frances)?|paes)$/,
    queijo:
      /^(queijo(?: minas| branco| mucarela| mussarela)?|mussarela|mucarela)$/,
    "grao-de-bico": /^grao[ -]de[ -]bico(?: cozido)?$/,
    aveia: /^aveia(?: em flocos| fina| grossa)?$/,
    banana: /^bananas?(?: prata| nanica)?$/,
    cenoura: /^cenouras?$/,
    batata: /^batatas?(?: inglesa)?$/,
    frango: /^(frango|peito de frango|file de frango)$/,
  };
  const match = (ingredient: string) =>
    available.filter((f) => aliases[ingredient]?.test(normalize(f.name)));
  const ranked = recipes
    .map((r) => ({
      ...r,
      found: r.ingredients.filter((i) => match(i).length),
      missing: r.ingredients.filter((i) => !match(i).length),
      urgent: r.ingredients.filter((i) =>
        match(i).some((f) => daysLeft(f.expirationDate) <= 7),
      ).length,
    }))
    .filter((r) => r.found.length)
    .sort(
      (a, b) =>
        (prioritize ? b.urgent - a.urgent : 0) ||
        a.missing.length - b.missing.length ||
        b.found.length - a.found.length,
    )
    .slice(0, 3);
  if (!ranked.length)
    return "Ainda não encontrei ingredientes compatíveis no estoque disponível. Cadastre alimentos como ovos, tomate, banana, arroz ou cenoura.";
  return (
    "Ideias do catálogo local" +
    (prioritize ? " priorizando o que vence em até 7 dias" : "") +
    ":\n\n" +
    ranked
      .map(
        (r) =>
          `${r.name}\nVocê tem: ${r.found.join(", ")}.\n${r.missing.length ? "Falta comprar: " + r.missing.join(", ") : "Os ingredientes principais estão no estoque."}\nPreparo: ${r.steps}`,
      )
      .join("\n\n") +
    "\n\nAlimentos sem validade informada exigem que você confira a embalagem e a conservação antes de usar. Confira as quantidades para as porções desejadas e os temperos básicos. As sugestões não descontam ingredientes automaticamente."
  );
}
