import type { RecipeMeta } from "../types";

/**
 * Tags + approximate per-serving nutrition for base chicken & fish recipes.
 * Estimates = USDA-ish totals of all ingredients ÷ servings. Unmeasured
 * "for serving" toppings/sides are counted at a modest typical amount.
 */
export const META: Record<string, RecipeMeta> = {
  "lemon-herb-sheet-pan-chicken": {
    tags: ["veggie-heavy", "one-pan", "kid-friendly", "meal-prep"],
    nutrition: { calories: 420, protein: 39 },
  },
  "chicken-burrito-bowls": {
    tags: ["kid-friendly", "meal-prep"],
    nutrition: { calories: 700, protein: 52 },
  },
  "greek-chicken-cucumber-salad": {
    tags: ["one-pan", "meal-prep"],
    nutrition: { calories: 460, protein: 43 },
  },
  "chicken-veggie-stir-fry": {
    tags: ["veggie-heavy", "kid-friendly", "meal-prep"],
    nutrition: { calories: 480, protein: 42 },
  },
  "sheet-pan-chicken-fajitas": {
    tags: ["one-pan", "kid-friendly", "meal-prep"],
    nutrition: { calories: 480, protein: 44 },
  },
  "lighter-tuscan-chicken": {
    tags: ["one-pan", "kid-friendly", "meal-prep"],
    nutrition: { calories: 370, protein: 45 },
  },
  "chicken-shawarma-sheet-pan": {
    tags: ["veggie-heavy", "one-pan", "meal-prep"],
    nutrition: { calories: 610, protein: 48 },
  },
  "lemon-chicken-white-bean-soup": {
    tags: ["one-pan", "kid-friendly", "meal-prep"],
    nutrition: { calories: 290, protein: 32 },
  },
  "pesto-chicken-tomatoes": {
    tags: ["veggie-heavy", "one-pan", "kid-friendly", "meal-prep"],
    nutrition: { calories: 410, protein: 46 },
  },
  "honey-garlic-salmon-asparagus": {
    tags: ["kid-friendly"],
    nutrition: { calories: 400, protein: 34 },
  },
  "salmon-potatoes-green-beans": {
    tags: ["one-pan", "kid-friendly"],
    nutrition: { calories: 490, protein: 37 },
  },
  "blackened-fish-tacos": {
    tags: ["one-pan"],
    nutrition: { calories: 390, protein: 37 },
  },
};
