import { RECIPES } from "./all-recipes";
import { pantryScore } from "./pantry";
import type { Filters, Recipe } from "./types";

export function matchesDislikes(recipe: Recipe, dislikes: string[]): boolean {
  if (!dislikes.length) return false;
  const text = recipe.ingredients.map((i) => i.item.toLowerCase()).join(" | ");
  // Whole-word match (optional plural) so "egg" doesn't hide eggplant
  // and "pea" doesn't hide peanuts or chickpeas.
  return dislikes.some((d) => {
    const w = d.trim().replace(/(es|s)$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return w.length > 0 && new RegExp(`\\b${w}(es|s)?\\b`, "i").test(text);
  });
}

export function candidates(
  filters: Filters,
  dislikes: string[],
  blocked: string[]
): Recipe[] {
  const tags = filters.tags ?? [];
  return RECIPES.filter(
    (r) =>
      (filters.maxMinutes == null || r.minutes <= filters.maxMinutes) &&
      (filters.protein == null || r.protein === filters.protein) &&
      tags.every((t) => r.tags?.includes(t)) &&
      !blocked.includes(r.id) &&
      !matchesDislikes(r, dislikes)
  );
}

export type PickOptions = {
  /** ids cooked recently; skipped unless nothing else is left */
  cooked?: string[];
  /** if set, favor recipes that use these pantry items */
  pantry?: string[];
};

/**
 * Pick a random recipe. Prefers recipes not recently cooked and not recently
 * rolled, falling back step by step so a narrow filter still gets a result.
 * With a pantry, picks are weighted toward recipes that use more of it.
 */
export function pickRecipe(
  pool: Recipe[],
  recent: string[],
  opts: PickOptions = {}
): Recipe | null {
  if (!pool.length) return null;
  const cooked = new Set(opts.cooked ?? []);
  // Recently cooked dinners sit out unless nothing else fits.
  const notCooked = pool.filter((r) => !cooked.has(r.id));
  const base = notCooked.length ? notCooked : pool;
  // Avoid recent rolls (newest first). If that would leave fewer than two
  // choices, forget the oldest ones first, so a small pool still rotates
  // instead of repeating the dinner just shown.
  const ids = new Set(base.map((r) => r.id));
  const recentHere = recent.filter((id) => ids.has(id));
  const enough = Math.min(2, base.length);
  let from = base;
  for (let k = recentHere.length; k > 0; k--) {
    const avoid = new Set(recentHere.slice(0, k));
    const left = base.filter((r) => !avoid.has(r.id));
    if (left.length >= enough) {
      from = left;
      break;
    }
  }

  if (opts.pantry?.length) {
    // weight = 1 + 6 × (share of ingredients already on hand), so a recipe
    // using most of the pantry is several times likelier, but nothing is excluded
    const weights = from.map((r) => 1 + 6 * pantryScore(r, opts.pantry!).score);
    let x = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < from.length; i++) {
      x -= weights[i];
      if (x <= 0) return from[i];
    }
    return from[from.length - 1];
  }
  return from[Math.floor(Math.random() * from.length)];
}
