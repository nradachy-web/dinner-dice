// The full recipe library: hand-written base set + extra batches, with
// tags/nutrition merged in for base recipes. Batch imports are generated.
import { BASE_RECIPES } from "./recipes";
import type { Recipe, RecipeMeta } from "./types";
// @generated-imports-start
import { BATCH as xBeefComfort } from "./recipes-extra/beef-comfort";
import { BATCH as xChickenGlobal } from "./recipes-extra/chicken-global";
import { BATCH as xFishMix } from "./recipes-extra/fish-mix";
import { BATCH as xGroundBeef } from "./recipes-extra/ground-beef";
import { BATCH as xPorkChops } from "./recipes-extra/pork-chops";
import { BATCH as xPorkGround } from "./recipes-extra/pork-ground";
import { BATCH as xPorkTenderloin } from "./recipes-extra/pork-tenderloin";
import { BATCH as xSalmon } from "./recipes-extra/salmon";
import { BATCH as xShrimpAsian } from "./recipes-extra/shrimp-asian";
import { BATCH as xShrimpWest } from "./recipes-extra/shrimp-west";
import { BATCH as xSteak } from "./recipes-extra/steak";
import { BATCH as xTurkeyCutlet } from "./recipes-extra/turkey-cutlet";
import { BATCH as xTurkeyGround } from "./recipes-extra/turkey-ground";
import { BATCH as xVeggieBeans } from "./recipes-extra/veggie-beans";
import { BATCH as xVeggieCheese } from "./recipes-extra/veggie-cheese";
import { BATCH as xWhiteFish } from "./recipes-extra/white-fish";
import { META as mBase1 } from "./recipe-meta/base-1";
import { META as mBase2 } from "./recipe-meta/base-2";
import { META as mBase3 } from "./recipe-meta/base-3";
import { META as mBase4 } from "./recipe-meta/base-4";
// @generated-imports-end

const EXTRA: Recipe[][] = [
  // @generated-extra
  xBeefComfort,
  xChickenGlobal,
  xFishMix,
  xGroundBeef,
  xPorkChops,
  xPorkGround,
  xPorkTenderloin,
  xSalmon,
  xShrimpAsian,
  xShrimpWest,
  xSteak,
  xTurkeyCutlet,
  xTurkeyGround,
  xVeggieBeans,
  xVeggieCheese,
  xWhiteFish,
];

const META: Record<string, RecipeMeta>[] = [
  // @generated-meta
  mBase1,
  mBase2,
  mBase3,
  mBase4,
];

const metaById: Record<string, RecipeMeta> = Object.assign({}, ...META);

const PASTA = /\b(pasta|spaghetti|penne|linguine|fettuccine|fusilli|ziti|rigatoni|orzo|macaroni|shells|egg noodles)\b/i;
/** Rice/soba noodles aren't "pasta night"; neither is an optional side. */
const NOT_PASTA = /\b(rice noodles?|vermicelli|soba|udon|ramen|spaghetti squash)\b/i;

/** Auto-tag pasta dishes so the Pasta filter works for every batch. */
function withPastaTag(r: Recipe): Recipe {
  const isPasta = r.ingredients.some(
    (i) => PASTA.test(i.item) && !NOT_PASTA.test(i.item) && !/for serving/i.test(i.note ?? "")
  );
  if (!isPasta || r.tags?.includes("pasta")) return r;
  return { ...r, tags: [...(r.tags ?? []), "pasta"] };
}

export const RECIPES: Recipe[] = [
  ...BASE_RECIPES.map((r) => (metaById[r.id] ? { ...r, ...metaById[r.id] } : r)),
  ...EXTRA.flat(),
].map(withPastaTag);

export const RECIPES_BY_ID: Record<string, Recipe> = Object.fromEntries(
  RECIPES.map((r) => [r.id, r])
);
