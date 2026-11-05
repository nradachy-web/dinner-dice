import { callGeminiJson } from "@/lib/gemini";
import type { Ingredient, Nutrition, Protein, Recipe, Step, Tag } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 45;

const PROTEINS: Protein[] = ["chicken", "fish", "shrimp", "beef", "turkey", "pork", "veggie"];
/** Tags the AI may assign. Never "pasta". */
const AI_TAGS: Tag[] = ["veggie-heavy", "one-pan", "kid-friendly", "meal-prep"];
const TAG_HINTS: Record<string, string> = {
  "veggie-heavy": "veggie-heavy (vegetables are at least half the plate)",
  "one-pan": "one-pan (cooked in a single skillet, sheet pan or pot)",
  "kid-friendly": "kid-friendly (mild, familiar flavors kids will eat)",
  "meal-prep": "meal-prep (reheats well for lunches the next days)",
};

type Body = {
  maxMinutes?: number | null;
  protein?: Protein | null;
  dislikes?: string[];
  avoidTitles?: string[];
  tags?: Tag[];
};

type Raw = {
  title?: unknown;
  emoji?: unknown;
  blurb?: unknown;
  why?: unknown;
  protein?: unknown;
  minutes?: unknown;
  servings?: unknown;
  ingredients?: { qty?: unknown; unit?: unknown; item?: unknown; note?: unknown }[];
  steps?: { text?: unknown; timer?: unknown }[];
  tags?: unknown;
  nutrition?: { calories?: unknown; protein?: unknown };
};

const str = (v: unknown, max = 300) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

export async function POST(request: Request) {
  let body: Body = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object") body = parsed as Body;
  } catch {
    /* empty body is fine */
  }

  const protein = PROTEINS.includes(body.protein as Protein) ? body.protein : null;
  const maxMinutes = Math.min(Math.max(Number(body.maxMinutes) || 45, 15), 60);
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const dislikes = list(body.dislikes).map((d) => str(d, 40)).filter(Boolean).slice(0, 20);
  const avoid = list(body.avoidTitles).map((t) => str(t, 80)).filter(Boolean).slice(0, 15);
  const wantTags = Array.isArray(body.tags)
    ? AI_TAGS.filter((t) => (body.tags as unknown[]).includes(t))
    : [];

  const prompt = `You are a home cook and registered dietitian. Invent ONE delicious, genuinely healthy, easy weeknight DINNER recipe.

Rules:
- Whole, minimally processed ingredients a US grocery store (Meijer/Aldi/Kroger) carries.
- Cook only with extra-virgin olive oil, avocado oil, butter/ghee, or coconut oil. NEVER canola, vegetable, soybean or corn oil, and no margarine.
- No refined white sugar. A little honey or maple syrup is OK.
- No processed meats (no bacon, hot dogs, deli meat, sausage), no canned soups, no mixes or packets.
- Prefer wild-caught fish, grass-fed beef, pasture-raised chicken/eggs.
- Total time ≤ ${maxMinutes} minutes, ≤ 14 ingredients, 4–6 steps. Beginner-friendly.
- Real, tested-sounding proportions that a family would actually love. Flavor matters as much as health.
- Main protein: ${protein ?? "your choice"} ("veggie" = vegetarian).
${dislikes.length ? `- Do NOT use any of these: ${dislikes.join(", ")}.` : ""}
${avoid.length ? `- Do not make any of these (already suggested): ${avoid.join("; ")}.` : ""}
${wantTags.length ? `- The recipe MUST be: ${wantTags.map((t) => TAG_HINTS[t]).join("; ")}.` : ""}

Return ONLY JSON in exactly this shape:
{"title":string,"emoji":string (one emoji),"blurb":string (one appetizing sentence),"why":string (one sentence on why it's healthy),"protein":one of ${JSON.stringify(PROTEINS)},"minutes":number,"servings":4,
"ingredients":[{"qty":number or null,"unit":string (e.g. "lb","cup","tbsp","tsp","cloves","" for countable items),"item":string (just the food, e.g. "chicken thighs"),"note":string (prep like "diced", or "")}],
"steps":[{"text":string,"timer":number of minutes or null (only for steps that involve waiting: simmer, roast, bake, rest)}],
"tags":array of any that truly apply, chosen ONLY from ${JSON.stringify(AI_TAGS)},
"nutrition":{"calories":number (approx kcal per serving),"protein":number (approx grams of protein per serving)}}
qty must be a decimal number (0.5 not "1/2").`;

  try {
    const raw = await callGeminiJson<Raw>(prompt, 0.95);

    const ingredients: Ingredient[] = (Array.isArray(raw.ingredients) ? raw.ingredients : [])
      .filter((i) => i && typeof i === "object")
      .map((i) => ({
        qty: num(i.qty),
        unit: str(i.unit, 20),
        item: str(i.item, 80),
        note: str(i.note, 80) || undefined,
      }))
      .filter((i) => i.item);

    const steps: Step[] = (Array.isArray(raw.steps) ? raw.steps : [])
      .filter((s) => s && typeof s === "object")
      .map((s) => {
        const t = num(s.timer);
        return { text: str(s.text, 500), timer: t ? Math.min(Math.round(t), 120) : undefined };
      })
      .filter((s) => s.text);

    const tags: Tag[] = Array.isArray(raw.tags)
      ? AI_TAGS.filter((t) => (raw.tags as unknown[]).includes(t))
      : [];
    for (const t of wantTags) if (!tags.includes(t)) tags.push(t);

    const cal = num(raw.nutrition?.calories);
    const pro =
      typeof raw.nutrition?.protein === "number" && Number.isFinite(raw.nutrition.protein)
        ? raw.nutrition.protein
        : null;
    const nutrition: Nutrition | undefined =
      cal !== null && pro !== null
        ? {
            calories: Math.round(Math.min(Math.max(cal, 150), 1500)),
            protein: Math.round(Math.min(Math.max(pro, 0), 120)),
          }
        : undefined;

    const title = str(raw.title, 80);
    if (!title || ingredients.length < 3 || steps.length < 2) {
      return Response.json({ error: "The AI came back with a half-baked recipe. Roll again." }, { status: 502 });
    }

    const recipe: Recipe = {
      id: `wild-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      emoji: str(raw.emoji, 8) || "🎲",
      blurb: str(raw.blurb),
      why: str(raw.why),
      protein: PROTEINS.includes(raw.protein as Protein) ? (raw.protein as Protein) : protein ?? "veggie",
      minutes: Math.min(Math.max(Math.round(num(raw.minutes) ?? maxMinutes), 5), 180),
      servings: Math.min(Math.max(Math.round(num(raw.servings) ?? 4), 1), 16),
      ingredients,
      steps,
      source: "wildcard",
      tags,
      nutrition,
    };
    return Response.json({ recipe });
  } catch (err) {
    console.error("wildcard error", err);
    return Response.json(
      { error: "Couldn't reach the AI chef right now." },
      { status: 502 }
    );
  }
}
