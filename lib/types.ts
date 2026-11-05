export type Protein =
  | "chicken"
  | "fish"
  | "shrimp"
  | "beef"
  | "turkey"
  | "pork"
  | "veggie";

export type Ingredient = {
  qty: number | null;
  unit: string;
  item: string;
  note?: string;
};

export type Step = {
  text: string;
  /** minutes, if this step has a built-in timer */
  timer?: number;
};

export type Recipe = {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  why: string;
  protein: Protein;
  minutes: number;
  servings: number;
  ingredients: Ingredient[];
  steps: Step[];
  source: "library" | "wildcard";
  /** quick-glance tags; filterable */
  tags?: Tag[];
  /** approximate, per serving */
  nutrition?: Nutrition;
};

export type Tag = "veggie-heavy" | "one-pan" | "kid-friendly" | "meal-prep" | "pasta";

export const TAG_LABELS: Record<Tag, string> = {
  "veggie-heavy": "🥦 Veggie-heavy",
  "one-pan": "🍳 One-pan",
  "kid-friendly": "🧒 Kid-friendly",
  "meal-prep": "📦 Meal-prep",
  pasta: "🍝 Pasta",
};

export const ALL_TAGS = Object.keys(TAG_LABELS) as Tag[];

/** Approximate nutrition per serving. */
export type Nutrition = {
  calories: number;
  /** grams */
  protein: number;
};

export type RecipeMeta = { tags: Tag[]; nutrition: Nutrition };

export type Filters = {
  maxMinutes: number | null;
  protein: Protein | null;
  /** recipe must have ALL of these tags */
  tags?: Tag[];
};

export const PROTEIN_LABELS: Record<Protein, string> = {
  chicken: "Chicken",
  fish: "Fish",
  shrimp: "Shrimp",
  beef: "Beef",
  turkey: "Turkey",
  pork: "Pork",
  veggie: "Veggie",
};
