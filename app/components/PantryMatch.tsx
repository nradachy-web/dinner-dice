"use client";

import { pantryScore } from "@/lib/pantry";
import { useAppState } from "@/lib/store";
import type { Recipe } from "@/lib/types";

const MAX_NEED = 4;

/**
 * "🥫 You've got most of this already" — only when pantry mode is on and the
 * pantry isn't empty. Uses spans only, so it's safe inside a <button> card.
 */
export function PantryMatch({ recipe, showNeed = true }: { recipe: Recipe; showNeed?: boolean }) {
  const app = useAppState();
  if (!app.pantryMode || !app.pantry.length) return null;

  const { have, need } = pantryScore(recipe, app.pantry);
  const total = have.length + need.length;
  if (!total) return null;

  const shown = need.slice(0, MAX_NEED);
  const more = need.length - shown.length;

  return (
    <span className="mt-2 block rounded-2xl bg-sage-soft px-3.5 py-2.5 text-left text-[14px] leading-snug text-sage">
      <span className="block font-semibold">
        🥫{" "}
        {need.length === 0
          ? "You've got everything — nothing to buy!"
          : have.length / total >= 0.6
            ? "You've got most of this already"
            : have.length > 0
              ? "You've got a head start on this one"
              : "Needs a quick shop"}
      </span>
      {showNeed && need.length > 0 && (
        <span className="mt-0.5 block text-[13px] text-ink/70">
          Still need: {shown.join(", ")}
          {more > 0 && ` +${more} more`}
        </span>
      )}
    </span>
  );
}
