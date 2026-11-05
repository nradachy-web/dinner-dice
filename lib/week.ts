// Week planner: pure functions for rolling a week of dinners and building
// one consolidated grocery list from it. No React, no storage — the UI
// persists the returned WeekPlan via setAppState.
import { formatQty } from "./format";
import { isGmoRisk } from "./gmo";
import { pickRecipe } from "./roll";
import type { WeekPlan, WeekSlot } from "./store";
import type { Ingredient, Protein, Recipe } from "./types";

export type WeekRollOptions = {
  /** ids of recently rolled recipes (app.recent) */
  recent: string[];
  /** ids cooked recently (recentlyCookedIds(app.history)) */
  cooked: string[];
  /** pantry items to favor, only when pantry mode is on */
  pantry?: string[];
};

export const NIGHT_OPTIONS = [5, 6, 7] as const;

// ───────────────────────── rolling ─────────────────────────

/** Pick a recipe for slot `index`, given the other slots already in the week. */
function pickForSlot(
  slots: WeekSlot[],
  index: number,
  pool: Recipe[],
  opts: WeekRollOptions,
  exclude: string[] = []
): Recipe | null {
  if (!pool.length) return null;
  const others = slots.filter((_, i) => i !== index);
  const usedIds = new Set([
    ...others.map((s) => s.recipe?.id).filter((id): id is string => !!id),
    ...exclude,
  ]);
  const neighbors = new Set<Protein>(
    [slots[index - 1]?.recipe?.protein, slots[index + 1]?.recipe?.protein].filter(
      (p): p is Protein => !!p
    )
  );
  const proteinCount = new Map<Protein, number>();
  for (const s of others) {
    if (s.recipe) proteinCount.set(s.recipe.protein, (proteinCount.get(s.recipe.protein) ?? 0) + 1);
  }

  const fresh = pool.filter((r) => !usedIds.has(r.id));
  const nonAdjacent = fresh.filter((r) => !neighbors.has(r.protein));
  const tiers = [
    // different protein from neighbors and not already used twice this week
    nonAdjacent.filter((r) => (proteinCount.get(r.protein) ?? 0) < 2),
    nonAdjacent,
    fresh,
    // tiny pool: allow a repeat rather than leave the night empty,
    // but still avoid the recipe being replaced
    pool.filter((r) => !exclude.includes(r.id)),
    pool,
  ];
  const from = tiers.find((t) => t.length) ?? pool;
  return pickRecipe(from, opts.recent, { cooked: opts.cooked, pantry: opts.pantry });
}

/**
 * Roll a week. Locked slots stay put; skipped nights (recipe null, not locked)
 * from an existing plan stay skipped; every other night is (re)filled with no
 * duplicate recipe within the week and varied proteins night to night.
 */
export function rollWeek(
  plan: WeekPlan | null,
  nights: number,
  pool: Recipe[],
  opts: WeekRollOptions
): WeekPlan {
  const prev = plan?.slots ?? [];
  const keepDate = prev.some((s) => s.locked && s.recipe);
  // Skips belong to a date: only keep them while night 1 is still the same day.
  const sameStart =
    !!plan && (keepDate || new Date(plan.createdAt).toDateString() === new Date().toDateString());
  const isFixed = (old: WeekSlot | undefined) =>
    !!old && ((old.locked && !!old.recipe) || (sameStart && !old.recipe));
  const slots: WeekSlot[] = Array.from({ length: nights }, (_, i) =>
    isFixed(prev[i]) ? prev[i] : { recipe: null, locked: false }
  );
  const fixed = slots.map((_, i) => isFixed(prev[i]));

  for (let i = 0; i < slots.length; i++) {
    if (fixed[i]) continue;
    slots[i] = { recipe: pickForSlot(slots, i, pool, opts), locked: false };
  }

  return withChecked({
    createdAt: keepDate && plan ? plan.createdAt : Date.now(),
    slots,
    checked: plan?.checked ?? [],
  });
}

/** Drop checked keys for items no longer on the list, so they don't come back pre-checked. */
function withChecked(plan: WeekPlan): WeekPlan {
  const keys = new Set(groceryList(plan).flatMap((s) => s.items.map((i) => i.key)));
  return { ...plan, checked: (plan.checked ?? []).filter((k) => keys.has(k)) };
}

/** Re-roll one night (also used to restore a skipped night). Unlocks it. */
export function rerollSlot(
  plan: WeekPlan,
  index: number,
  pool: Recipe[],
  opts: WeekRollOptions
): WeekPlan {
  if (index < 0 || index >= plan.slots.length) return plan;
  const current = plan.slots[index].recipe;
  const recipe = pickForSlot(plan.slots, index, pool, opts, current ? [current.id] : []);
  return withChecked({
    ...plan,
    slots: plan.slots.map((s, i) => (i === index ? { recipe: recipe ?? current, locked: false } : s)),
  });
}

/** Change the number of nights: trims from the end, or rolls the new nights. */
export function resizeWeek(
  plan: WeekPlan,
  nights: number,
  pool: Recipe[],
  opts: WeekRollOptions
): WeekPlan {
  if (nights <= plan.slots.length) return withChecked({ ...plan, slots: plan.slots.slice(0, nights) });
  const slots: WeekSlot[] = [
    ...plan.slots,
    ...Array.from({ length: nights - plan.slots.length }, () => ({ recipe: null, locked: false })),
  ];
  for (let i = plan.slots.length; i < nights; i++) {
    slots[i] = { recipe: pickForSlot(slots, i, pool, opts), locked: false };
  }
  return withChecked({ ...plan, slots });
}

export function toggleLock(plan: WeekPlan, index: number): WeekPlan {
  return {
    ...plan,
    slots: plan.slots.map((s, i) => (i === index && s.recipe ? { ...s, locked: !s.locked } : s)),
  };
}

/** Skip a night (eating out, leftovers…). Restore it with rerollSlot. */
export function skipSlot(plan: WeekPlan, index: number): WeekPlan {
  return withChecked({
    ...plan,
    slots: plan.slots.map((s, i) => (i === index ? { recipe: null, locked: false } : s)),
  });
}

/** Date for night `index` of a plan (night 0 = the day the plan was made). */
export function nightDate(plan: WeekPlan, index: number): Date {
  const d = new Date(plan.createdAt);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + index);
  return d;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon", "Tue", … for night `index`. */
export function nightLabel(plan: WeekPlan, index: number): string {
  return DAY_NAMES[nightDate(plan, index).getDay()];
}

// ───────────────────────── grocery list ─────────────────────────

export const SECTIONS = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Pantry & Dry Goods",
  "Spices & Oils",
  "Frozen",
  "Other",
] as const;
export type Section = (typeof SECTIONS)[number];

export type GroceryAmount = { qty: number; unit: string };

export type GroceryItem = {
  /** stable key for WeekPlan.checked */
  key: string;
  /** display name, e.g. "yellow onions" */
  name: string;
  /** measured amounts, one per unit after merging (may be empty) */
  amounts: GroceryAmount[];
  /** some recipe lists it without a quantity (to taste, for serving…) */
  unmeasured: boolean;
  section: Section;
  gmo: boolean;
  /** recipes in the week that use this item */
  recipes: { id: string; title: string; emoji: string }[];
};

export type GrocerySection = { section: Section; items: GroceryItem[] };

/** Lowercase, trim, collapse spaces, singularize the last word. */
export function normalizeItem(item: string): string {
  const s = item
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    // same thing, different wording across recipes
    .replace(/\b(parmesan|feta|mozzarella|cheddar|monterey jack) cheese$/, "$1")
    .replace(/^cayenne pepper$/, "cayenne")
    .replace(/^pure maple syrup$/, "maple syrup");
  return s.replace(/([a-zà-ÿ]+)$/, (w) => singular(w));
}

const IRREGULAR_SINGULAR: Record<string, string> = { leaves: "leaf", chilies: "chile", chilis: "chile" };

function singular(w: string): string {
  if (IRREGULAR_SINGULAR[w]) return IRREGULAR_SINGULAR[w];
  if (w.length <= 3) return w;
  if (/(ss|us|is|ous)$/.test(w)) return w;
  if (/ies$/.test(w)) return w.slice(0, -3) + "y";
  if (/(oes|ches|shes|xes)$/.test(w)) return w.slice(0, -2);
  if (/s$/.test(w)) return w.slice(0, -1);
  return w;
}

// Words that read the same (or wrong) with an "s": "2 zucchini", "4 baby bok choy".
const NO_PLURAL = /(zucchini|choy|squash|adobo|celery|lettuce|broccoli|kale|spinach|fish|shrimp|salmon)$/i;

function pluralWord(w: string): string {
  if (/s$/.test(w) || NO_PLURAL.test(w)) return w;
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + "ies";
  if (/(tomato|potato|mango)$/.test(w) || /(ch|sh|x)$/.test(w)) return w + "es";
  return w + "s";
}

const UNIT_ALIASES: Record<string, string> = {
  teaspoon: "tsp",
  teaspoons: "tsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cups: "cup",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  ounce: "oz",
  ounces: "oz",
  cloves: "clove",
  pints: "pint",
  heads: "head",
  slices: "slice",
  stalks: "stalk",
  bunches: "bunch",
  cans: "can",
  jars: "jar",
  fillets: "fillet",
  sprigs: "sprig",
  packages: "package",
};

/** "Cans (15 oz)" → "can (15 oz)" */
export function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().replace(/\s+/g, " ").trim();
  // "2 medium sweet potatoes" + "2 sweet potatoes" → 4 sweet potatoes
  if (/^(small|medium|large|whole)$/.test(u)) return "";
  // "large heads" → "large head"
  return u.replace(/^([a-z]+)/, (w) => UNIT_ALIASES[w] ?? w).replace(/^(\w+ )?heads\b/, "$1head");
}

const PLURAL_UNITS: Record<string, string> = {
  cup: "cups",
  clove: "cloves",
  pint: "pints",
  head: "heads",
  slice: "slices",
  stalk: "stalks",
  bunch: "bunches",
  can: "cans",
  jar: "jars",
  fillet: "fillets",
  sprig: "sprigs",
  package: "packages",
  "large head": "large heads",
};

function displayUnit(unit: string, qty: number): string {
  if (qty <= 1) return unit;
  const m = unit.match(/^([a-z]+(?: head)?)(.*)$/);
  if (!m) return unit;
  return (PLURAL_UNITS[m[1]] ?? m[1]) + m[2];
}

/** Units that can be summed together (value = size in the family's base unit). */
const FAMILIES: Record<string, Record<string, number>> = {
  volume: { tsp: 1, tbsp: 3, cup: 48 },
  weight: { oz: 1, lb: 16 },
};

function familyOf(unit: string): [string, number] | null {
  for (const [fam, units] of Object.entries(FAMILIES)) {
    if (units[unit] != null) return [fam, units[unit]];
  }
  return null;
}

/** Express a merged base-unit total in the most natural unit of its family. */
function bestUnit(fam: string, base: number): GroceryAmount {
  if (fam === "volume") {
    const whole = (n: number) => Math.abs(n - Math.round(n)) < 1e-6;
    const cups = base / 48;
    const tbsp = base / 3;
    // ¼ / ⅓ cup steps read cleanest (16 tbsp → 1 cup, 16 tsp → ⅓ cup); ½ cup and up always cups
    if (base >= 12 && (whole(cups * 4) || whole(cups * 3))) return { qty: cups, unit: "cup" };
    if (base >= 24) return { qty: cups, unit: "cup" };
    // whole or half tablespoons (3 tsp → 1 tbsp), and 3+ tbsp even when odd
    if (base >= 3 && (whole(tbsp * 2) || base >= 9)) return { qty: tbsp, unit: "tbsp" };
    return { qty: base, unit: "tsp" };
  }
  if (base >= 16) return { qty: base / 16, unit: "lb" };
  return { qty: base, unit: "oz" };
}

type Rule = [Section, RegExp];

// Checked in order; first match wins.
const SECTION_RULES: Rule[] = [
  ["Frozen", /\bfrozen\b/],
  ["Produce", /\b(butter lettuce|sugar snap|snap peas?)\b/],
  [
    "Pantry & Dry Goods",
    /\b(broth|stock|bouillon|coconut (milk|cream)|peanut butter|almond butter|seed butter|sun-dried|paste|sauce|salsa|pesto|canned|vinegar|sriracha|dried (apricots?|fruit|cranberries)|chipotle( peppers?|s)? in adobo)\b/,
  ],
  [
    "Meat & Seafood",
    /\b(chicken|beef|steak|sirloin|turkey|pork|bacon|sausage|ham|prosciutto|lamb|shrimp|salmon|cod|tuna|tilapia|halibut|mahi|trout|scallops?|fish|fillets?)\b/,
  ],
  [
    "Dairy & Eggs",
    /\b(eggs?|milk|cream|half-and-half|butter|ghee|yogurt|cheese|parmesan|mozzarella|feta|cheddar|ricotta|cotija|monterey jack|goat cheese|cottage|kefir|halloumi)\b/,
  ],
  ["Bakery", /\b(bread|sourdough|tortillas?|pitas?|naan|buns?|bagels?|baguette|ciabatta|english muffins?|flatbread|wraps?)\b/],
  ["Produce", /\bfresh\b/],
  [
    "Spices & Oils",
    /\b(oil|salt|black pepper|pepper flakes|peppercorns?|cayenne|paprika|cumin|turmeric|cinnamon|oregano|thyme|seasoning|garlic powder|onion powder|chili powder|curry powder|garam masala|nutmeg|coriander|allspice|star anise|fennel seeds?|bay leaf|bay leaves|cloves ground|ground ginger|five-spice|za'atar|sumac|cooking spray|dried (basil|dill|rosemary|parsley|sage|italian herbs?|herbs?))\b/,
  ],
  [
    "Produce",
    /\b(onions?|garlic|lemons?|limes?|avocados?|tomato(es)?|spinach|broccoli|peppers?|jalape[nñ]os?|potato(es)?|cilantro|parsley|basil|dill|mint|chives?|ginger|cucumbers?|carrots?|celery|cabbage|lettuce|romaine|kale|arugula|greens|zucchini|squash|mushrooms?|green beans?|asparagus|brussels sprouts?|cauliflower|peas|scallions?|shallots?|leeks?|fennel|apples?|bananas?|berries|strawberries|blueberries|mango(es)?|pineapple|oranges?|grapes?|pears?|peach(es)?|corn|radish(es)?|beets?|eggplants?|slaw|sprouts?|herbs?|salad|bok choy|sweet potato(es)?|lemongrass|edamame)\b/,
  ],
  [
    "Pantry & Dry Goods",
    /\b(rice|quinoa|pasta|spaghetti|penne|linguine|fettuccine|fusilli|ziti|rigatoni|orzo|macaroni|noodles?|couscous|farro|beans?|lentils?|chickpeas?|oats?|flour|breadcrumbs|panko|sugar|honey|syrup|vinegar|tamari|soy|mustard|ketchup|mayo|mayonnaise|olives?|capers?|nuts?|almonds?|walnuts?|pecans?|cashews?|peanuts?|seeds?|tahini|arrowroot|cornstarch|baking|pickles?|raisins?|cranberries|chocolate|cocoa|vanilla|chips|crackers|hummus|coconut|wine|marinara|curry|tortilla chips|yeast|polenta|cornmeal)\b/,
  ],
];

export function sectionFor(item: string, unit = ""): Section {
  const text = item.toLowerCase().split(",")[0];
  if (/^(cans?|jars?)\b/.test(unit.toLowerCase()) && !/\bfrozen\b/.test(text)) return "Pantry & Dry Goods";
  for (const [section, re] of SECTION_RULES) if (re.test(text)) return section;
  return "Other";
}

/** "black beans (15 oz)" in "cans" → "black beans" in "cans (15 oz)", so both spellings merge. */
function canSizeToUnit(ing: Ingredient): Ingredient {
  const m = ing.item.match(/^(.*\S)\s*\((\d[\d.]*\s*oz)\)$/i);
  if (!m || !/^(cans?|jars?)$/i.test(ing.unit.trim())) return ing;
  return { ...ing, item: m[1], unit: `${ing.unit.trim()} (${m[2]})` };
}

/** Consolidated grocery list for every non-skipped night, grouped by section. */
export function groceryList(plan: WeekPlan | null): GrocerySection[] {
  if (!plan) return [];
  type Acc = {
    key: string;
    name: string;
    /** recipe wording when listed as one ("1 lemon") / as several ("2 lemons") */
    singleName?: string;
    pluralName?: string;
    counted: number; // total unitless quantity, to pick singular/plural display
    perUnit: Map<string, number>; // unit (or family) → total
    /** first amount seen per bucket, and how many amounts were merged into it */
    firstAmount: Map<string, GroceryAmount>;
    merges: Map<string, number>;
    unmeasured: boolean;
    section: Section;
    recipes: GroceryItem["recipes"];
  };
  const byKey = new Map<string, Acc>();

  for (const slot of plan.slots) {
    const r = slot.recipe;
    if (!r) continue;
    for (const raw of r.ingredients ?? []) {
      const ing = canSizeToUnit(raw);
      const key = normalizeItem(ing.item);
      if (!key) continue;
      let acc = byKey.get(key);
      if (!acc) {
        acc = {
          key,
          name: ing.item.replace(/\s+/g, " ").trim(),
          counted: 0,
          perUnit: new Map(),
          firstAmount: new Map(),
          merges: new Map(),
          unmeasured: false,
          section: sectionFor(ing.item, ing.unit),
          recipes: [],
        };
        byKey.set(key, acc);
      }
      if (!acc.recipes.some((x) => x.id === r.id)) {
        acc.recipes.push({ id: r.id, title: r.title, emoji: r.emoji });
      }
      if (ing.qty == null || ing.qty <= 0) {
        acc.unmeasured = true;
        continue;
      }
      const unit = normalizeUnit(ing.unit);
      const fam = familyOf(unit);
      const bucket = fam ? `@${fam[0]}` : unit;
      acc.perUnit.set(bucket, (acc.perUnit.get(bucket) ?? 0) + ing.qty * (fam ? fam[1] : 1));
      acc.merges.set(bucket, (acc.merges.get(bucket) ?? 0) + 1);
      if (!acc.firstAmount.has(bucket)) acc.firstAmount.set(bucket, { qty: ing.qty, unit });
      if (!unit) {
        acc.counted += ing.qty;
        const wording = ing.item.replace(/\s+/g, " ").trim();
        if (ing.qty > 1) acc.pluralName ??= wording;
        else acc.singleName ??= wording;
      }
    }
  }

  const items: GroceryItem[] = [...byKey.values()].map((acc) => {
    const amounts: GroceryAmount[] = [...acc.perUnit.entries()].map(([bucket, total]) => {
      // a single amount keeps the recipe's own unit ("⅓ cup", not "16 tsp")
      if (acc.merges.get(bucket) === 1) return acc.firstAmount.get(bucket)!;
      return bucket.startsWith("@") ? bestUnit(bucket.slice(1), total) : { qty: total, unit: bucket };
    });
    // Unitless only → name follows the count ("2 limes"), preferring the recipes' own wording.
    const onlyCount = amounts.length === 1 && amounts[0].unit === "";
    let name = acc.name;
    if (onlyCount && acc.counted > 1) {
      name =
        acc.pluralName ??
        (/[,()]| or | and /.test(name) ? name : name.replace(/([A-Za-zà-ÿ]+)$/, (w) => pluralWord(w)));
    } else if (onlyCount) {
      name = acc.singleName ?? name;
    }
    return {
      key: acc.key,
      name,
      amounts,
      unmeasured: acc.unmeasured && amounts.length === 0,
      section: acc.section,
      gmo: isGmoRisk(acc.name),
      recipes: acc.recipes,
    };
  });

  return SECTIONS.map((section) => ({
    section,
    items: items
      .filter((i) => i.section === section)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((s) => s.items.length);
}

/** Stable key for checking an item off (WeekPlan.checked). */
export function groceryKey(item: GroceryItem): string {
  return item.key;
}

/** "2 lb + 1 cup", "3", or "" when unmeasured. */
export function formatAmounts(amounts: GroceryAmount[]): string {
  return amounts
    .map((a) => [formatQty(a.qty), displayUnit(a.unit, a.qty)].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" + ");
}

/** Plain-text list for sharing (Notes, Messages…). Checked items are left off. */
export function groceryListText(sections: GrocerySection[], checked: string[] = []): string {
  const done = new Set(checked);
  const blocks = sections
    .map((s) => {
      const lines = s.items
        .filter((i) => !done.has(i.key))
        .map((i) => {
          const amt = formatAmounts(i.amounts);
          const gmo = i.gmo ? " (organic / non-GMO)" : "";
          return `• ${[amt, i.name].filter(Boolean).join(" ")}${gmo}`;
        });
      return lines.length ? `${s.section}\n${lines.join("\n")}` : "";
    })
    .filter(Boolean);
  return `This week’s groceries\n\n${blocks.join("\n\n")}`;
}
