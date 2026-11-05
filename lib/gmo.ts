/**
 * Only a handful of crops sold in US grocery stores are commonly genetically
 * engineered: corn, soy, canola, sugar beets (most non-cane "sugar"), and some
 * zucchini / yellow squash / papaya. USDA Organic forbids GMOs, so for these
 * items we tell you to buy organic or Non-GMO Project Verified. Everything
 * else is fine either way.
 */
const GMO_RISK =
  /\b(corn|cornstarch|soy|soybeans?|tamari|tofu|edamame|miso|canola|sugar|zucchini|yellow squash|papaya)\b/i;

const SAFE_EXCEPTIONS = /\b(coconut sugar|cane sugar|sugar snap|snap peas)\b/i;

export function isGmoRisk(item: string): boolean {
  if (SAFE_EXCEPTIONS.test(item)) return false;
  return GMO_RISK.test(item);
}

export const GMO_TIP =
  "Commonly GMO in the US — buy USDA Organic or Non-GMO Project Verified.";
