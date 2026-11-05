import type { RecipeMeta } from "../types";

// Approximate per-serving estimates (USDA-ish values, total ÷ servings).
// Unquantified "for serving" items (bread/orzo, side salad, chili toppings) are excluded.
export const META: Record<string, RecipeMeta> = {
  "mediterranean-baked-cod": { tags: ["one-pan"], nutrition: { calories: 390, protein: 36 } },
  "salmon-rice-bowls": { tags: ["kid-friendly"], nutrition: { calories: 550, protein: 40 } },
  "garlic-shrimp-broccoli-quinoa": { tags: ["meal-prep"], nutrition: { calories: 400, protein: 37 } },
  "shrimp-tacos-mango-salsa": { tags: ["kid-friendly"], nutrition: { calories: 400, protein: 33 } },
  "coconut-curry-shrimp": { tags: ["meal-prep"], nutrition: { calories: 560, protein: 36 } },
  "greek-shrimp-feta": { tags: ["one-pan", "meal-prep"], nutrition: { calories: 310, protein: 35 } },
  "shrimp-fried-rice": { tags: ["one-pan", "kid-friendly", "meal-prep"], nutrition: { calories: 480, protein: 36 } },
  "beef-and-broccoli": { tags: ["kid-friendly", "meal-prep"], nutrition: { calories: 540, protein: 40 } },
  "burger-bowls": { tags: ["veggie-heavy", "kid-friendly"], nutrition: { calories: 600, protein: 36 } },
  "steak-chimichurri-potatoes": { tags: ["kid-friendly"], nutrition: { calories: 660, protein: 40 } },
  "beef-sweet-potato-chili": { tags: ["veggie-heavy", "one-pan", "kid-friendly", "meal-prep"], nutrition: { calories: 330, protein: 21 } },
  "stuffed-peppers": { tags: ["veggie-heavy", "kid-friendly", "meal-prep"], nutrition: { calories: 480, protein: 31 } },
};
