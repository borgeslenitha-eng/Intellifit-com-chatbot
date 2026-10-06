import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalize } from "../chat/validation";
type Model = {
  version: number;
  algorithm: string;
  threshold: number;
  minimumMargin: number;
  classes: string[];
  vocabulary: Record<string, number>;
  idf: number[];
  coefficients: number[][];
  intercepts: number[];
};
const model: Model = JSON.parse(
  readFileSync(resolve(__dirname, "../../ml/model.json"), "utf8"),
);
export function classify(text: string) {
  const words = normalize(text).match(/[a-z]{2,}/g) ?? [];
  const terms = [
    ...words,
    ...words.slice(0, -1).map((w, i) => w + " " + words[i + 1]),
  ];
  const counts = new Map<number, number>();
  for (const term of terms) {
    const i = model.vocabulary[term];
    if (i !== undefined) counts.set(i, (counts.get(i) ?? 0) + 1);
  }
  const values = [...counts].map(
    ([i, n]) => [i, (1 + Math.log(n)) * model.idf[i]] as const,
  );
  const norm = Math.sqrt(values.reduce((s, [, v]) => s + v * v, 0)) || 1;
  const logits = model.coefficients.map(
    (row, k) =>
      model.intercepts[k] +
      values.reduce((s, [i, v]) => s + (row[i] * v) / norm, 0),
  );
  const max = Math.max(...logits),
    exp = logits.map((x) => Math.exp(x - max)),
    sum = exp.reduce((a, b) => a + b, 0);
  const scores = exp.map((x) => x / sum);
  const ranking = model.classes
    .map((intent, i) => ({ intent, score: scores[i] }))
    .sort((a, b) => b.score - a.score);
  const top = ranking[0];
  return {
    intent: top.intent,
    confidence: top.score,
    accepted:
      values.length > 0 &&
      top.score >= model.threshold &&
      top.score - ranking[1].score >= model.minimumMargin,
    ranking,
    scores,
    source: "ml" as const,
  };
}
export const modelInfo = {
  version: model.version,
  algorithm: model.algorithm,
  threshold: model.threshold,
  minimumMargin: model.minimumMargin,
  classes: model.classes,
};
