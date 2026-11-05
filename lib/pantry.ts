// Pantry matching: does what's on hand cover a recipe's ingredients?
//
// Matching is word-based (so "rice" never matches "licorice"), plural-blind
// ("tomatoes" == "tomato"), and knows a few things about food:
//   • a pantry entry covers more specific items: "chicken" → "chicken thighs",
//     "beef" → "grass-fed ground beef", "yogurt" → "plain greek yogurt"
//   • soft words in what you type are ignored: "greek yogurt" → "yogurt",
//     "frozen corn" → "corn", "whole-wheat penne" → "penne"
//   • products made FROM a thing don't count: "chicken" ≠ "chicken broth",
//     "tomato" ≠ "tomato paste", "avocado" ≠ "avocado oil"
//   • lookalikes don't count: "potato" ≠ "sweet potato", "onion" ≠ "green onion",
//     "butter" ≠ "peanut butter", "pepper" means bell pepper (black pepper is a staple)
// Staples (salt, pepper, water, cooking oils, dried spices) are ignored: they
// count as neither "have" nor "need", so the score is the share of REAL
// ingredients you already have.
import type { Recipe } from "./types";

export type PantryMatch = {
  /** 0..1 — share of the recipe's non-staple ingredients already on hand */
  score: number;
  /** ingredient item names the user has */
  have: string[];
  /** ingredient item names still needed */
  need: string[];
};

// ───────────── normalization ─────────────

const NO_SINGULAR = new Set([
  "hummus", "asparagus", "couscous", "swiss", "molasses", "bass", "grits", "oats",
  "brussels", "lentils", "greens", "peas", "chips", "panko", "series", "species",
]);

function singular(w: string): string {
  if (w.length <= 3 || NO_SINGULAR.has(w)) {
    // a few plurals we still want to fold
    if (w === "oats") return "oat";
    if (w === "lentils") return "lentil";
    if (w === "peas") return "pea";
    if (w === "chips") return "chip";
    if (w === "greens") return "green";
    if (w === "brussels") return "brussel";
    return w;
  }
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("oes")) return w.slice(0, -2);
  if (/(ch|sh|ss|x|z)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Phrase-level synonyms, applied after singularizing (both sides). */
const ALIASES: [RegExp, string][] = [
  [/\bscallion\b/g, "green onion"],
  [/\bspring onion\b/g, "green onion"],
  [/\bgarbanzo(?: bean)?\b/g, "chickpea"],
  [/\bprawn\b/g, "shrimp"],
  [/\bcourgette\b/g, "zucchini"],
  [/\baubergine\b/g, "eggplant"],
  [/\bcapsicum\b/g, "bell pepper"],
  [/\bstock\b/g, "broth"],
  [/\bsoy sauce\b/g, "tamari"],
  [/\bshoyu\b/g, "tamari"],
  [/\begg white\b/g, "egg"],
  [/\bbreadcrumb\b/g, "bread crumb"],
  // "red pepper" (not flakes) means a bell pepper
  [/(?<!crushed )\b(red|green|yellow|orange) pepper\b(?! flake| powder)/g, "$1 bell pepper"],
];

function tokenize(s: string): string[] {
  const words = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // jalapeño → jalapeno
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singular);
  let joined = words.join(" ");
  for (const [re, to] of ALIASES) joined = joined.replace(re, to);
  return joined.split(" ").filter(Boolean);
}

/** Split "avocado, salsa & greek yogurt" / "salt and pepper" into parts. */
function splitParts(item: string): string[] {
  return item
    .toLowerCase()
    .split(/,|\s+and\s+|\s*&\s*|\s*\+\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// ───────────── staples ─────────────

/** Always staples when the part ENDS with these words. */
const STAPLE_TAILS = [
  "salt", "black pepper", "white pepper", "water", "olive oil", "avocado oil",
  "cooking spray", "neutral oil", "vegetable oil", "cooking oil",
  "cumin", "paprika", "chili powder", "chile powder", "cayenne", "cayenne pepper",
  "turmeric", "cinnamon", "garam masala", "curry powder", "nutmeg", "allspice",
  "italian seasoning", "taco seasoning", "cajun seasoning", "creole seasoning",
  "everything bagel seasoning", "old bay", "old bay seasoning", "za atar", "zaatar",
  "five spice", "five spice powder", "chinese five spice", "red pepper flake",
  "chili flake", "crushed red pepper", "bay leaf", "garlic powder", "onion powder",
  "chipotle powder", "ancho chile powder", "mustard powder", "dry mustard",
  "herbes de provence", "poultry seasoning", "lemon pepper",
  "italian herb", "cinnamon stick", "star anise", "star anise pod", "fennel seed", "skewer",
].map((s) => s.split(" "));

/** Staples only when "dried" / "ground" (fresh versions are real ingredients). */
const DRIED_ONLY = new Set([
  "oregano", "thyme", "basil", "rosemary", "dill", "sage", "parsley", "ginger",
  "coriander", "clove", "mustard", "marjoram", "tarragon", "fennel", "cardamom",
]);

const STAPLE_EXACT = new Set(["pepper", "oil", "salt pepper", "kosher salt", "sea salt"]);

function endsWith(tokens: string[], tail: string[]): boolean {
  if (tail.length > tokens.length) return false;
  const off = tokens.length - tail.length;
  return tail.every((t, i) => tokens[off + i] === t);
}

function isStapleTokens(tokens: string[]): boolean {
  if (!tokens.length) return true;
  // drop words like "freshly", "ground", "fine", "flaky" for the exact check
  const core = tokens.filter((t) => !["freshly", "fine", "flaky", "coarse", "kosher", "sea", "to", "taste"].includes(t));
  if (!core.length || STAPLE_EXACT.has(core.join(" "))) return true;
  if (STAPLE_TAILS.some((tail) => endsWith(tokens, tail))) return true;
  const last = tokens[tokens.length - 1];
  if (DRIED_ONLY.has(last) && (tokens.includes("dried") || tokens.includes("ground"))) return true;
  return false;
}

// ───────────── pantry entries ─────────────

/** Words dropped from what you type: "greek yogurt" → "yogurt". */
const SOFT = new Set([
  "fresh", "organic", "plain", "greek", "wild", "grass", "fed", "pasture", "raised",
  "boneless", "skinless", "extra", "virgin", "frozen", "cooked", "leftover", "raw",
  "whole", "wheat", "grain", "free", "range", "lb", "lbs", "pound", "oz", "can",
  "jar", "bag", "box", "of", "some", "a", "an", "the", "large", "small", "medium",
  "chopped", "sliced", "shredded", "grated", "low", "sodium", "unsalted", "salted",
  "baby", "thin", "cut", "pack", "package", "bunch", "head", "fillet", "filet",
]);

/** One pantry entry can stand for several things. */
const EXPANSIONS: Record<string, string[]> = {
  pasta: [
    "pasta", "spaghetti", "penne", "linguine", "fettuccine", "fusilli", "ziti", "rigatoni",
    "orzo", "macaroni", "rotini", "farfalle", "lasagna", "spaghettini", "bucatini",
  ],
  noodle: ["noodle", "spaghetti", "linguine", "fettuccine", "ramen", "udon", "soba"],
  fish: ["fish", "salmon", "cod", "tilapia", "halibut", "trout", "mahi", "haddock", "snapper", "tuna", "bass"],
  "white fish": ["white fish", "cod", "tilapia", "halibut", "haddock", "snapper", "mahi"],
  beef: ["beef", "steak"],
  steak: ["steak", "sirloin", "flank", "skirt", "ribeye"],
  lettuce: ["lettuce", "romaine", "spring mix"],
  // "greens" singularizes to "green"
  green: ["spinach", "kale", "arugula", "spring mix", "chard", "collard green", "lettuce", "romaine"],
  cheese: [
    "cheese", "cheddar", "mozzarella", "parmesan", "feta", "monterey jack", "cotija",
    "halloumi", "ricotta", "goat cheese",
  ],
  "canned tomato": ["diced tomato", "crushed tomato", "stewed tomato", "whole peeled tomato"],
};

/** Something made FROM the matched word: "chicken broth", "tomato paste". */
const PRODUCT_NEXT = new Set([
  "broth", "paste", "sauce", "powder", "flake", "vinegar", "seasoning", "flour",
  "tortilla", "chip", "starch", "meal", "extract", "oil", "milk", "butter", "water",
  "noodle", "crumb", "wrapper", "cheese", "spread", "jam", "syrup", "dressing", "salsa",
  "vermicelli", "ricotta", "yogurt", "greek", "mozzarella", "spaghetti", "penne", "fusilli",
  // lookalikes named after the word: "butter lettuce", "spaghetti squash", "bean sprouts"
  "lettuce", "squash", "sprout",
]);

/** Lookalikes: a word before the matched word that makes it a different food. */
const FORBID_PREV: Record<string, string[]> = {
  potato: ["sweet"],
  onion: ["green"],
  bean: ["green"],
  butter: ["peanut", "almond", "cashew", "nut", "apple", "sunflower", "seed"],
  milk: ["coconut", "almond", "oat", "soy", "cashew", "condensed", "evaporated"],
  cream: ["sour", "ice", "coconut"],
  cheese: ["cream", "cottage"],
  pepper: ["black", "white", "cayenne", "lemon", "chipotle", "poblano"],
  rice: ["cauliflower"],
  flour: ["almond", "coconut"],
  tomato: ["dried", "crushed", "diced", "roasted", "stewed", "peeled"],
  pea: ["snap"],
  sugar: ["coconut", "brown"],
};

type Alt = { tokens: string[]; set: Set<string> };
type PreparedEntry = Alt[];

function prepareEntry(raw: string): PreparedEntry | null {
  const all = tokenize(raw);
  // "peppers" in a pantry means bell peppers (black pepper is a staple)
  if (all.join(" ") === "pepper") return [{ tokens: ["pepper"], set: new Set(["pepper"]) }];
  if (!all.length || isStapleTokens(all)) return null;
  let tokens = all.filter((t) => !SOFT.has(t));
  if (!tokens.length) tokens = all; // e.g. "greens" or only soft words
  const key = tokens.join(" ");
  const alts = EXPANSIONS[key] ?? [key];
  return alts.map((a) => {
    const t = tokenize(a);
    return { tokens: t, set: new Set(t) };
  });
}

function altMatches(alt: Alt, item: string[], itemSet: Set<string>): boolean {
  for (const t of alt.tokens) if (!itemSet.has(t)) return false;
  const head = alt.tokens[alt.tokens.length - 1];
  const forbid = FORBID_PREV[head];
  for (let i = 0; i < item.length; i++) {
    if (item[i] !== head) continue;
    const next = item[i + 1];
    if (next && PRODUCT_NEXT.has(next) && !alt.set.has(next)) continue;
    const prev = item[i - 1];
    if (prev && forbid?.includes(prev) && !alt.set.has(prev)) continue;
    return true;
  }
  return false;
}

// ───────────── per-item analysis (cached) ─────────────

type PreparedPart = { tokens: string[]; set: Set<string> };
/** null = staple (ignored) */
type PreparedItem = PreparedPart[] | null;

const itemCache = new Map<string, PreparedItem>();

function prepareItem(item: string): PreparedItem {
  if (typeof item !== "string") return null; // malformed (e.g. old saved wild card)
  const hit = itemCache.get(item);
  if (hit !== undefined) return hit;
  const parts = splitParts(item)
    .map(tokenize)
    .filter((t) => t.length && !isStapleTokens(t))
    .map((tokens) => ({ tokens, set: new Set(tokens) }));
  const prepared = parts.length ? parts : null;
  itemCache.set(item, prepared);
  return prepared;
}

let lastPantryKey: string | null = null;
let lastPantry: PreparedEntry[] = [];

function preparePantry(pantry: string[]): PreparedEntry[] {
  const key = pantry.join("\u0001");
  if (key === lastPantryKey) return lastPantry;
  lastPantryKey = key;
  lastPantry = pantry
    .filter((p): p is string => typeof p === "string")
    .map(prepareEntry).filter((e): e is PreparedEntry => e !== null);
  return lastPantry;
}

/** Every part ("avocado, salsa") must be covered by something in the pantry. */
function covered(parts: PreparedPart[], entries: PreparedEntry[]): boolean {
  return parts.every((p) => entries.some((alts) => alts.some((a) => altMatches(a, p.tokens, p.set))));
}

// ───────────── public API ─────────────

/** Is this ingredient a staple (salt, pepper, oil, dried spice) that pantry mode ignores? */
export function isPantryStaple(item: string): boolean {
  return prepareItem(item) === null;
}

/** Canonical form of a pantry entry, for de-duping ("Tomatoes" == "tomato"). */
export function pantryKey(entry: string): string {
  return typeof entry === "string" ? tokenize(entry).join(" ") : "";
}

/** Add entries to a pantry list, skipping blanks and duplicates (by pantryKey). */
export function addToPantry(pantry: string[], entries: string[]): string[] {
  // drop anything malformed from older saves
  const out = pantry.filter((p) => typeof p === "string" && pantryKey(p));
  const seen = new Set(out.map(pantryKey));
  for (const raw of entries) {
    const e = raw.trim().toLowerCase().replace(/\s+/g, " ");
    const k = pantryKey(e);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

/** Remove an entry (matched by pantryKey) from a pantry list. */
export function removeFromPantry(pantry: string[], entry: string): string[] {
  const k = pantryKey(entry);
  return pantry.filter((p) => typeof p === "string" && pantryKey(p) !== k);
}

/** Does a pantry entry (e.g. "chicken") cover an ingredient item (e.g. "boneless skinless chicken thighs")? */
export function pantryHas(item: string, pantry: string[]): boolean {
  const parts = prepareItem(item);
  if (!parts) return false; // staple: not tracked
  return covered(parts, preparePantry(pantry));
}

export function pantryScore(recipe: Recipe, pantry: string[]): PantryMatch {
  const have: string[] = [];
  const need: string[] = [];
  const entries = preparePantry(pantry);
  for (const i of recipe.ingredients ?? []) {
    const parts = prepareItem(i?.item);
    if (!parts) continue; // staple: neither have nor need
    (entries.length && covered(parts, entries) ? have : need).push(i.item);
  }
  const total = have.length + need.length;
  return { score: total ? have.length / total : 0, have, need };
}
