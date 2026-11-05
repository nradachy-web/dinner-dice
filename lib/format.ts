import type { Ingredient } from "./types";

const FRACTIONS: [number, string][] = [
  [0, ""],
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
  [1, ""],
];

export function formatQty(n: number): string {
  if (n <= 0) return "";
  // Big numbers: round to whole (e.g. 12 shrimp, 6 eggs)
  if (n >= 10) return String(Math.round(n));
  let whole = Math.floor(n);
  const frac = n - whole;
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) {
    if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  }
  if (best[0] === 1) {
    whole += 1;
    best = FRACTIONS[0];
  }
  if (whole === 0 && !best[1]) return "⅛";
  return `${whole || ""}${best[1]}`;
}

export function formatIngredient(ing: Ingredient, scale: number) {
  const amount =
    ing.qty == null
      ? ""
      : [formatQty(ing.qty * scale), ing.unit].filter(Boolean).join(" ");
  return { amount, item: ing.item, note: ing.note };
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
