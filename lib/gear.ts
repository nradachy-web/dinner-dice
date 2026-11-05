import type { Ingredient, Recipe } from "./types";

/**
 * "Grab these first" (mise en place): figure out the oven, cookware and
 * ingredients a recipe needs from plain keyword rules on its text.
 * Pure + deterministic, so it works for library and wild-card recipes alike.
 */

export type GearItem = { id: string; emoji: string; label: string };

export type OvenPrep =
  | { kind: "oven"; temp: number; label: string }
  | { kind: "broiler"; label: string };

export type PullItem = { index: number; label: string };

export type GrabList = {
  oven: OvenPrep | null;
  gear: GearItem[];
  fridge: PullItem[];
  pantry: PullItem[];
};

type Rule = { id: string; emoji: string; label: string; test: RegExp };

// Order here = order shown. Pans first, then prep tools.
const RULES: Rule[] = [
  {
    id: "sheet-pan",
    emoji: "🟫",
    label: "Sheet pan",
    test: /sheet[- ]pan|baking sheet|rimmed (baking )?(sheet|pan)/,
  },
  { id: "wok", emoji: "🥘", label: "Wok", test: /\bwok\b/ },
  { id: "grill-pan", emoji: "🍳", label: "Grill pan", test: /grill pan|\bgrill\b/ },
  { id: "skillet", emoji: "🍳", label: "Large skillet", test: /skillet|frying pan|saut[eé] pan/ },
  { id: "dutch-oven", emoji: "🍲", label: "Dutch oven", test: /dutch oven/ },
  { id: "pot", emoji: "🍲", label: "Big pot", test: /\b(large|big|stock|soup|pasta) pot\b/ },
  { id: "saucepan", emoji: "🥣", label: "Small pot", test: /saucepan|\bsmall pot\b/ },
  {
    id: "baking-dish",
    emoji: "🥧",
    label: "Baking dish",
    test: /baking dish|casserole|9\s?[x×]\s?13|gratin/,
  },
  { id: "bowl", emoji: "🥣", label: "Mixing bowl", test: /\b(a|in|into|mixing|large|big|medium|small|huge|heatproof|one) bowl\b/ },
  { id: "shallow-dish", emoji: "🍽️", label: "Shallow dish", test: /shallow dish/ },
  { id: "whisk", emoji: "🥄", label: "Whisk", test: /whisk/ },
  { id: "blender", emoji: "🌀", label: "Blender", test: /blend|food processor/ },
  { id: "colander", emoji: "🫗", label: "Colander", test: /\bdrain\b|colander|strainer/ },
  { id: "skewers", emoji: "🍢", label: "Skewers", test: /skewer/ },
  { id: "foil", emoji: "📜", label: "Foil", test: /\bfoil\b/ },
  { id: "parchment", emoji: "📜", label: "Parchment", test: /parchment/ },
  { id: "grater", emoji: "🧀", label: "Grater / zester", test: /\bgrat(e|ed|ing)\b|\bzest|microplane/ },
];

const KNIFE_WORDS = /\b(dic|chop|minc|slic|cut|halv|quarter|julienn|wedge|cube)/;

/** Ingredients that live in the fridge or freezer. Everything else = pantry & counter. */
const FRIDGE =
  /\b(chicken|beef|steak|sirloin|flank|pork|turkey|sausage|bacon|prosciutto|ham|shrimp|salmon|fish|cod|tilapia|halibut|mahi|tuna|scallop|egg|eggs|milk|cream|yogurt|cheese|feta|parmesan|parmigiano|mozzarella|cheddar|ricotta|goat cheese|butter|ghee|tofu|tempeh|frozen|spinach|kale|lettuce|romaine|greens|arugula|cilantro|parsley|basil|mint|dill|chives|cucumber|bell pepper|zucchini|broccoli|broccolini|cauliflower|carrot|celery|mushroom|green onion|scallion|cabbage|slaw|ginger|salsa|hummus|pesto|tortilla|kimchi|snap pea|snow pea|green bean|asparagus|bok choy|berries|jalape[nñ]o|tzatziki|sour cream|edamame|haddock|trout|sea bass|monterey jack|halloumi|half-and-half|bean sprouts|poblano|lemongrass stalk|fresh (rosemary|thyme|oregano|sage)|cooked (\w+ )*rice)s?\b/;

/** Pantry things whose names contain fridge words ("chicken broth", "peanut butter"). */
const PANTRY_OVERRIDE =
  /broth|stock|powder|dried|\bdry\b|\bground (cumin|ginger|coriander|cinnamon|turmeric|pepper)|oil\b|vinegar|peanut butter|almond butter|nut butter|seed butter|coconut milk|coconut cream|flakes|seasoning|paste|fish sauce|soy sauce|hot sauce|sauce\b|cream of tartar|butter beans/;

/** Always on hand by the stove: not worth a chip. */
const SKIP =
  /^(water|ice|cooking spray|(sea |kosher |flaky )?salt|((coarsely )?(ground )?black )?pepper|(sea )?salt and (black )?pepper)$/;

function ovenFrom(steps: string[]): OvenPrep | null {
  for (const s of steps) {
    const t = s.toLowerCase();
    const m = t.match(/(\d{3})\s*°\s*f/);
    if (m && /oven|bake|roast/.test(t)) {
      const temp = Number(m[1]);
      return { kind: "oven", temp, label: `Oven on → ${temp}°F` };
    }
  }
  if (steps.some((s) => /broil/i.test(s))) return { kind: "broiler", label: "Broiler on high" };
  return null;
}

function isFridge(ing: Ingredient) {
  const name = ing.item.toLowerCase();
  if (/\bcan\b|\bjar\b|canned/.test(`${ing.unit} ${name}`.toLowerCase())) return false;
  if (PANTRY_OVERRIDE.test(name)) return false;
  return FRIDGE.test(name);
}

export function grabList(recipe: Recipe): GrabList {
  const steps = recipe.steps.map((s) => s.text);
  const stepText = [recipe.title, ...steps].join(" \n ").toLowerCase();
  const notes = recipe.ingredients.map((i) => (i.note ?? "").toLowerCase()).join(" \n ");

  const gear: GearItem[] = RULES.filter((r) => {
    if (r.id === "grater") return r.test.test(stepText) || r.test.test(notes);
    return r.test.test(stepText);
  }).map(({ id, emoji, label }) => ({ id, emoji, label }));

  const has = (id: string) => gear.some((g) => g.id === id);
  const drop = (id: string) => gear.splice(gear.findIndex((g) => g.id === id), 1);
  const oven = ovenFrom(steps);

  // "Wok or large skillet" / "grill pan or skillet" = one pan, not two.
  if (has("wok") && has("skillet") && /wok or (a )?(large |big )?skillet|skillet or (a )?wok/.test(stepText)) {
    drop("skillet");
    gear.find((g) => g.id === "wok")!.label = "Wok (or big skillet)";
  }
  if (has("grill-pan") && has("skillet") && /grill pan or (a )?(large )?skillet|skillet or (a )?grill pan/.test(stepText)) {
    drop("skillet");
    gear.find((g) => g.id === "grill-pan")!.label = "Grill pan (or skillet)";
  }

  // Roasting or baking with no vessel named ("on a lined pan", "Roast, flipping once") → a sheet pan,
  // unless the skillet itself goes in the oven.
  const ovenVessel = ["sheet-pan", "baking-dish", "dutch-oven"].some(has);
  if (
    oven?.kind === "oven" &&
    !ovenVessel &&
    /\b(roast|bake)\b|lined pan/.test(stepText) &&
    !/oven-?safe|ovenproof|(skillet|pan) (in|into|to) the oven/.test(stepText)
  ) {
    gear.unshift({ id: "sheet-pan", emoji: "🟫", label: "Sheet pan" });
  }

  // Cooking pasta, rice or grains, boiling water, or a plain "pot". ("Bring the sauce to a boil" in a
  // skillet doesn't count.)
  const GRAIN =
    "rice|quinoa|couscous|farro|pasta|noodles|spaghetti|linguine|fettuccine|penne|ziti|rigatoni|rotini|fusilli|shells|orzo|soba|udon|vermicelli|potatoes";
  const needsPot =
    /\bpot\b|boiling water|salted water|\bboil (the )?(water|pasta|potatoes|eggs)/.test(stepText) ||
    new RegExp(`\\bbring [^.]*\\b(water|${GRAIN})\\b[^.]*to a boil`).test(stepText) ||
    new RegExp(`\\b(cook|boil|simmer)\\s+(the\\s+)?([\\w-]+\\s+){0,3}(${GRAIN})\\b`).test(
      stepText.replace(/cauliflower rice|riced cauliflower/g, "")
    );
  if (!["pot", "saucepan", "dutch-oven"].some(has) && needsPot) {
    const at = gear.findIndex((g) => !["sheet-pan", "wok", "grill-pan", "skillet"].includes(g.id));
    gear.splice(at < 0 ? gear.length : at, 0, { id: "pot", emoji: "🍲", label: "Pot" });
  }
  const PANS = ["sheet-pan", "skillet", "grill-pan", "wok", "baking-dish", "dutch-oven", "pot", "saucepan"];
  const STOVE_PANS = ["skillet", "grill-pan", "wok", "dutch-oven"];
  // "the pan", "sear in oil over medium-high heat"… with nothing more specific → a skillet.
  // Also when something gets browned or seared outside the pot (baked ziti: "Brown turkey…").
  const searsOutsidePot = steps.some((x) => {
    const t = x.toLowerCase();
    return (
      /(^|[.;]\s+)(then |meanwhile, )?(brown|sear|saut[eé]|stir-fry)\b|\bin (the )?(hot )?oil\b/.test(t) &&
      !/\bpot\b|saucepan|dutch oven|sheet pan|oven|broil|baking dish/.test(t)
    );
  });
  if (
    (!gear.some((g) => PANS.includes(g.id)) &&
      /\bpan\b|\bsear|saut[eé]|stir-fry|over (low|medium|medium-high|high) heat/.test(stepText)) ||
    (!STOVE_PANS.some(has) && searsOutsidePot)
  ) {
    gear.unshift({ id: "skillet", emoji: "🍳", label: "Large skillet" });
  }

  // Knife + board whenever anything gets cut.
  if (KNIFE_WORDS.test(notes) || KNIFE_WORDS.test(stepText)) {
    gear.push({ id: "knife", emoji: "🔪", label: "Cutting board + knife" });
  }

  const fridge: PullItem[] = [];
  const pantry: PullItem[] = [];
  const seen = new Set<string>();
  recipe.ingredients.forEach((ing, index) => {
    const label = ing.item.trim();
    const key = label.toLowerCase();
    if (!label || SKIP.test(key) || seen.has(key)) return;
    seen.add(key);
    (isFridge(ing) ? fridge : pantry).push({ index, label });
  });

  return { oven, gear, fridge, pantry };
}

/** The very first concrete thing to do, for the "Start cooking" button. */
export function firstMove(recipe: Recipe): string {
  const { oven, gear } = grabList(recipe);
  if (oven?.kind === "oven") return `Turn the oven on to ${oven.temp}°F`;
  if (oven?.kind === "broiler") return "Turn the broiler on";
  const pan = gear.find((g) => g.id !== "knife");
  if (pan) return `Grab the ${pan.label.toLowerCase()}`;
  return "Set out the ingredients";
}
