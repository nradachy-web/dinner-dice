import { Fragment } from "react";
import { TAG_LABELS, type Recipe } from "@/lib/types";

function nutritionLine(recipe: Recipe): string | null {
  const n = recipe.nutrition;
  if (!n) return null;
  const parts: string[] = [];
  if (Number.isFinite(n.calories) && n.calories > 0) parts.push(`≈${Math.round(n.calories)} cal`);
  if (Number.isFinite(n.protein) && n.protein >= 0) parts.push(`${Math.round(n.protein)}g protein`);
  return parts.length ? `${parts.join(" · ")} per serving` : null;
}

export function NutritionBadges({ recipe, compact }: { recipe: Recipe; compact?: boolean }) {
  const line = nutritionLine(recipe);
  const tags = [...new Set(Array.isArray(recipe.tags) ? recipe.tags : [])].filter((t) => t in TAG_LABELS);

  if (!line && !tags.length) return null;

  if (compact) {
    // Spans only (this sits inside a <button> card). Tags stay whole and the
    // line wraps between them instead of overflowing the card.
    return (
      <span className="mt-1 block text-[13px] leading-snug text-muted">
        {line}
        {tags.map((t, i) => (
          <Fragment key={t}>
            {line || i > 0 ? " · " : ""}
            <span className="whitespace-nowrap">{TAG_LABELS[t]}</span>
          </Fragment>
        ))}
      </span>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {line && (
        <p className="text-sm font-semibold text-ink">
          {line}
          <span className="ml-1.5 text-xs font-normal text-muted">≈ estimate</span>
        </p>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-medium text-ink"
            >
              {TAG_LABELS[t]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
