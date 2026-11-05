// Sticker book: collectible stickers derived purely from cooked history.
// Nothing is stored, so a sticker can never be lost, broken or "expire".
import { RECIPES_BY_ID } from "./all-recipes";
import { markCooked, setAppState, type CookedEntry } from "./store";
import type { Protein, Recipe } from "./types";

export type Sticker = {
  id: string;
  emoji: string;
  name: string;
  /** playful line shown once earned */
  description: string;
  /** gentle clue shown while it's still a mystery */
  hint: string;
};

/** A cooked dinner with its recipe resolved (library or saved wild card). */
type Cooked = { entry: CookedEntry; recipe: Recipe | undefined; text: string };

type Rule = Sticker & {
  /** earned if ANY cooked dinner matches */
  any?: (c: Cooked) => boolean;
  /** earned from the whole collection */
  all?: (c: Cooked[]) => boolean;
};

/** keyword in the title or ingredient list */
const has = (re: RegExp) => (c: Cooked) => re.test(c.text);
/** keyword in the title only (ingredients like "chili powder" would over-match) */
const titled = (re: RegExp) => (c: Cooked) => re.test((c.recipe?.title ?? c.entry.title).toLowerCase());
const tagged = (tag: NonNullable<Recipe["tags"]>[number]) => (c: Cooked) => !!c.recipe?.tags?.includes(tag);
const protein = (p: Protein) => (c: Cooked) => c.recipe?.protein === p;
const distinct = (n: number) => (cs: Cooked[]) => new Set(cs.map((c) => c.entry.id)).size >= n;

const PROTEINS: Protein[] = ["chicken", "fish", "shrimp", "beef", "turkey", "pork", "veggie"];

const RULES: Rule[] = [
  // ── milestones (distinct dinners, never streaks) ──
  {
    id: "first-bite",
    emoji: "🍽️",
    name: "First Bite",
    description: "You cooked a real dinner. That's the whole trick.",
    hint: "Cook any dinner at all.",
    all: (cs) => cs.length > 0,
  },
  {
    id: "explorer-5",
    emoji: "🧭",
    name: "Explorer",
    description: "Five different dinners. Your taste buds are on a field trip.",
    hint: "Try a handful of different dinners.",
    all: distinct(5),
  },
  {
    id: "explorer-10",
    emoji: "🗺️",
    name: "Adventurer",
    description: "Ten different dinners. The map keeps getting bigger.",
    hint: "Keep trying new dinners.",
    all: distinct(10),
  },
  {
    id: "explorer-25",
    emoji: "🌍",
    name: "Globetrotter",
    description: "Twenty-five different dinners. Practically a food tour.",
    hint: "A big pile of different dinners.",
    all: distinct(25),
  },
  {
    id: "explorer-50",
    emoji: "👑",
    name: "Dinner Royalty",
    description: "Fifty different dinners. Bow down, kitchen.",
    hint: "A truly legendary pile of different dinners.",
    all: distinct(50),
  },
  {
    id: "old-favorite",
    emoji: "💛",
    name: "Old Favorite",
    description: "You made one again because it was good. Comfort counts.",
    hint: "Cook a dinner you've made before.",
    all: (cs) => new Set(cs.map((c) => c.entry.id)).size < cs.length,
  },

  // ── proteins ──
  { id: "chicken", emoji: "🐔", name: "Chicken Champ", description: "Winner winner, chicken dinner.", hint: "Cook a chicken dinner.", any: protein("chicken") },
  { id: "fish", emoji: "🐟", name: "Fish Friend", description: "Omega-3s and good vibes.", hint: "Cook a fish dinner.", any: protein("fish") },
  { id: "shrimp", emoji: "🦐", name: "Shrimp Shrimp Hooray", description: "Small shrimp, big hooray.", hint: "Cook a shrimp dinner.", any: protein("shrimp") },
  { id: "beef", emoji: "🐄", name: "Beef Boss", description: "Iron-strong and running the show.", hint: "Cook a beef dinner.", any: protein("beef") },
  { id: "turkey", emoji: "🦃", name: "Turkey Trot", description: "Not just for November.", hint: "Cook a turkey dinner.", any: protein("turkey") },
  { id: "pork", emoji: "🐷", name: "Pork Pal", description: "Juicy, cozy, done.", hint: "Cook a pork dinner.", any: protein("pork") },
  { id: "plant", emoji: "🌱", name: "Plant Power", description: "Beans, greens and good things.", hint: "Cook a veggie dinner.", any: protein("veggie") },
  {
    id: "passport",
    emoji: "🎒",
    name: "Protein Passport",
    description: "Every protein, stamped. You've been everywhere.",
    hint: "Collect all seven protein stickers.",
    all: (cs) => PROTEINS.every((p) => cs.some((c) => c.recipe?.protein === p)),
  },

  // ── cuisines & styles ──
  { id: "taco", emoji: "🌮", name: "Taco Night", description: "Any night can be taco night.", hint: "Something in a tortilla.", any: has(/\b(taco|fajita|burrito|enchilada|quesadilla|carnitas|tortilla)/) },
  { id: "pasta", emoji: "🍝", name: "Pasta Party", description: "Twirl, slurp, repeat.", hint: "Any pasta dinner.", any: tagged("pasta") },
  { id: "curry", emoji: "🍛", name: "Curry Club", description: "Warm, saucy, a hug in a bowl.", hint: "Something saucy and spiced.", any: titled(/\b(curry|tikka|masala|korma|dal)\b/) },
  { id: "stir-fry", emoji: "🥢", name: "Stir-Fry Fly", description: "Hot pan, quick hands, big flavor.", hint: "Something tossed fast in a hot pan.", any: titled(/\b(stir-fry|stir fry|fried rice|teriyaki|krapow|thai basil|beef & broccoli|beef and broccoli)/) },
  { id: "med", emoji: "☀️", name: "Mediterranean Sun", description: "Lemon, olive oil and a little sunshine.", hint: "Think lemon, feta and olives.", any: titled(/\b(greek|mediterranean|shawarma|souvlaki|gyro|kofta|tzatziki|halloumi|moroccan|niçoise|tuscan)/) },
  { id: "bbq", emoji: "🔥", name: "BBQ Buddy", description: "Smoky, charred and very happy about it.", hint: "Something smoky or grilled.", any: titled(/\b(bbq|barbecue|jerk|huli|grilled|kebab|skewer|blackened|smoky|chimichurri)/) },
  { id: "soup", emoji: "🍲", name: "Soup's On", description: "Spoon in hand, cozy achieved.", hint: "Something you eat with a spoon.", any: titled(/\b(soup|chili|chowder|pho|stew)\b/) },
  { id: "bowl", emoji: "🥣", name: "Bowl Life", description: "Everything good, all in one bowl.", hint: "A dinner that comes in a bowl.", any: titled(/\bbowls?\b/) },
  { id: "noodle", emoji: "🍜", name: "Noodle Doodle", description: "Slurping is encouraged.", hint: "Noodles that aren't Italian.", any: has(/\b(noodle|soba|udon|ramen|pho|lo mein|pad thai)/) },
  { id: "salad", emoji: "🥗", name: "Salad Days", description: "Crunchy, fresh and actually filling.", hint: "A dinner salad.", any: titled(/\bsalad\b/) },
  { id: "wrap", emoji: "🌯", name: "Wrap Star", description: "Wrapped, rolled and ready to roll.", hint: "Something you eat with your hands.", any: titled(/\b(wraps?|lettuce cups|pitas?|burgers?|banh mi)\b(?! bowls?)/) },
  { id: "sheet-pan", emoji: "🦸", name: "Sheet-Pan Hero", description: "One tray, zero fuss. Heroic.", hint: "Everything on one tray in the oven.", any: titled(/sheet[- ]pan/) },
  { id: "one-pan", emoji: "🍳", name: "One-Pan Wonder", description: "Fewer dishes is a love language.", hint: "A one-pan dinner.", any: tagged("one-pan") },
  { id: "veggie-heavy", emoji: "🥦", name: "Veggie Heavyweight", description: "Plants lifted. Gains made.", hint: "A veggie-heavy dinner.", any: tagged("veggie-heavy") },
  { id: "kid-friendly", emoji: "🧸", name: "Crowd Pleaser", description: "Even picky eaters said yes.", hint: "A kid-friendly dinner.", any: tagged("kid-friendly") },
  { id: "meal-prep", emoji: "📦", name: "Future You Says Thanks", description: "Leftovers are a gift to tomorrow.", hint: "A dinner that makes great leftovers.", any: tagged("meal-prep") },

  // ── vibes ──
  {
    id: "brave",
    emoji: "🃏",
    name: "Brave Roller",
    description: "You trusted the wild card. Bold move, tasty result.",
    hint: "Cook a wild card dinner.",
    any: (c) => c.recipe?.source === "wildcard",
  },
  {
    id: "fried-fed",
    emoji: "😮‍💨",
    name: "Fried but Fed",
    description: "Low battery, still made dinner. That counts double.",
    hint: "Cook a quick one, 25 minutes or less.",
    any: (c) => !!c.recipe && c.recipe.minutes <= 25,
  },
];

export const STICKERS: Sticker[] = RULES.map(({ id, emoji, name, description, hint }) => ({
  id,
  emoji,
  name,
  description,
  hint,
}));

export const STICKERS_BY_ID: Record<string, Sticker> = Object.fromEntries(STICKERS.map((s) => [s.id, s]));

function resolve(history: CookedEntry[], recipesById: Record<string, Recipe>): Cooked[] {
  return history.map((entry) => {
    const recipe = recipesById[entry.id] ?? entry.recipe;
    const text = [recipe?.title ?? entry.title, ...(recipe?.ingredients.map((i) => i.item) ?? [])]
      .join(" · ")
      .toLowerCase();
    return { entry, recipe, text };
  });
}

/** Ids of every sticker the cooked history has earned. */
export function earned(history: CookedEntry[], recipesById: Record<string, Recipe>): Set<string> {
  return earnedFrom(resolve(history, recipesById));
}

function earnedFrom(cooked: Cooked[]): Set<string> {
  const out = new Set<string>();
  for (const r of RULES) {
    if ((r.any && cooked.some(r.any)) || (r.all && r.all(cooked))) out.add(r.id);
  }
  return out;
}

/**
 * When each earned sticker first arrived (epoch ms of the dinner that earned it),
 * so the book can show the newest ones first.
 */
export function earnedAt(history: CookedEntry[], recipesById: Record<string, Recipe>): Map<string, number> {
  const oldestFirst = resolve(
    [...history].sort((a, b) => a.at - b.at),
    recipesById
  );
  const out = new Map<string, number>();
  for (let i = 1; i <= oldestFirst.length; i++) {
    for (const id of earnedFrom(oldestFirst.slice(0, i))) {
      if (!out.has(id)) out.set(id, oldestFirst[i - 1].entry.at);
    }
    if (out.size === RULES.length) break;
  }
  return out;
}

/** Stickers earned by `nextHistory` that `prevHistory` didn't have, in catalog order. */
export function newlyEarned(
  prevHistory: CookedEntry[],
  nextHistory: CookedEntry[],
  recipesById: Record<string, Recipe>
): Sticker[] {
  const before = earned(prevHistory, recipesById);
  const after = earned(nextHistory, recipesById);
  return STICKERS.filter((s) => after.has(s.id) && !before.has(s.id));
}

/** One short celebration line for freshly earned stickers ("" = none). */
export function stickerMessage(fresh: Sticker[]): string {
  if (fresh.length === 0) return "";
  if (fresh.length === 1) return `New sticker: ${fresh[0].emoji} ${fresh[0].name}!`;
  return `New stickers! ${fresh.map((f) => f.emoji).join(" ")}`;
}

/** Midnight (local) of the day containing `ms`. */
export function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Was this dinner already logged today? (One entry per dinner per day.) */
export function cookedToday(history: CookedEntry[], id: string, now = Date.now()) {
  const today = startOfDay(now);
  return history.some((h) => h.id === id && startOfDay(h.at) === today);
}

/**
 * The single "we cooked this" path, shared by CookedButton and cook mode's "Done!".
 * Logs the dinner (once per day) and works out any new stickers.
 * Returns null when it was already logged today, so nothing is double-counted.
 */
export function logCooked(recipe: Recipe, history: CookedEntry[]): { at: number; message: string } | null {
  if (cookedToday(history, recipe.id)) return null;
  const at = markCooked(recipe);
  const next: CookedEntry[] = [{ id: recipe.id, title: recipe.title, emoji: recipe.emoji, at, recipe }, ...history];
  return { at, message: stickerMessage(newlyEarned(history, next, RECIPES_BY_ID)) };
}

/** Remove the exact entry `logCooked` created (Undo). */
export function unlogCooked(id: string, at: number) {
  setAppState((s) => {
    const i = s.history.findIndex((h) => h.id === id && h.at === at);
    return i < 0 ? s : { ...s, history: [...s.history.slice(0, i), ...s.history.slice(i + 1)] };
  });
}
