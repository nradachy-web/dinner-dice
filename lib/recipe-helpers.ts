import type { Ingredient, Protein, Recipe, RecipeMeta, Step } from "./types";

/** [qty, unit, item, note?] — qty null means "to taste" / unmeasured */
export type I = [number | null, string, string, string?];

export function ing(list: I[]): Ingredient[] {
  return list.map(([qty, unit, item, note]) => ({ qty, unit, item, note }));
}

/** Steps may end in "⏱N" to attach an N-minute timer. */
export function steps(list: string[]): Step[] {
  return list.map((s) => {
    const m = s.match(/\s*⏱(\d+)\s*$/);
    return m
      ? { text: s.slice(0, m.index).trim(), timer: Number(m[1]) }
      : { text: s };
  });
}

export function r(
  id: string,
  title: string,
  emoji: string,
  protein: Protein,
  minutes: number,
  servings: number,
  blurb: string,
  why: string,
  ingredients: I[],
  stepList: string[],
  meta?: RecipeMeta
): Recipe {
  return {
    id,
    title,
    emoji,
    protein,
    minutes,
    servings,
    blurb,
    why,
    ingredients: ing(ingredients),
    steps: steps(stepList),
    source: "library",
    ...(meta ? { tags: meta.tags, nutrition: meta.nutrition } : {}),
  };
}
