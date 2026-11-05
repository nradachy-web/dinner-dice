// Quick-add pantry chips, built from what the recipe library actually uses.
// Each group lists candidate pantry words; only the ones that cover at least
// one ingredient in RECIPES are kept, most-used first.
import { RECIPES } from "./all-recipes";
import { pantryHas } from "./pantry";

const CANDIDATES: { group: string; items: string[] }[] = [
  {
    group: "Proteins",
    items: [
      "chicken", "chicken breast", "chicken thighs", "ground turkey", "ground beef", "steak",
      "shrimp", "salmon", "cod", "pork tenderloin", "pork chops", "sausage", "bacon", "eggs",
      "tofu",
    ],
  },
  {
    group: "Produce",
    items: [
      "garlic", "onion", "red onion", "green onions", "lemon", "lime", "ginger", "tomatoes",
      "bell pepper", "broccoli", "spinach", "kale", "avocado", "sweet potatoes", "potatoes",
      "zucchini", "cucumber", "carrots", "celery", "cilantro", "parsley", "basil", "dill",
      "mushrooms", "cauliflower", "asparagus", "green beans", "cabbage", "romaine", "jalapeño",
      "corn", "peas", "brussels sprouts", "snap peas", "edamame", "mango", "apples",
    ],
  },
  {
    group: "Dairy",
    items: [
      "greek yogurt", "parmesan", "feta", "mozzarella", "cheddar", "monterey jack", "ricotta",
      "cotija", "goat cheese", "butter", "heavy cream", "half-and-half", "milk", "sour cream",
    ],
  },
  {
    group: "Grains & Pasta",
    items: [
      "rice", "brown rice", "jasmine rice", "basmati rice", "quinoa", "pasta", "spaghetti",
      "penne", "orzo", "corn tortillas", "tortillas", "bread", "panko", "pita", "oats",
      "couscous", "farro", "noodles",
    ],
  },
  {
    group: "Cans & Jars",
    items: [
      "black beans", "chickpeas", "cannellini beans", "canned tomatoes", "crushed tomatoes",
      "tomato paste", "tomato sauce", "marinara", "salsa", "chicken broth", "beef broth",
      "coconut milk", "tamari", "pesto", "tahini", "dijon mustard", "honey", "maple syrup",
      "olives", "capers", "rice vinegar", "sesame oil", "curry paste", "fish sauce",
      "peanut butter", "sun-dried tomatoes",
    ],
  },
];

const MAX_PER_GROUP = 16;

function build(): { group: string; items: string[] }[] {
  const items = RECIPES.flatMap((r) => r.ingredients.map((i) => i.item));
  return CANDIDATES.map(({ group, items: cands }) => ({
    group,
    items: cands
      .map((c) => ({ c, n: items.filter((it) => pantryHas(it, [c])).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, MAX_PER_GROUP)
      .map((x) => x.c),
  })).filter((g) => g.items.length > 0);
}

export const PANTRY_SUGGESTIONS: { group: string; items: string[] }[] = build();
