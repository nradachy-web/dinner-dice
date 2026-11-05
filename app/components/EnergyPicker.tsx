"use client";

import { setAppState, useAppState, type Energy } from "@/lib/store";
import type { Recipe } from "@/lib/types";

type Level = Exclude<Energy, null>;

const OPTIONS: { value: Level; emoji: string; label: string }[] = [
  { value: "fried", emoji: "🫠", label: "Fried" },
  { value: "okay", emoji: "🙂", label: "Okay" },
  { value: "ready", emoji: "🔥", label: "Let’s cook" },
];

const LINES: Record<Level, string> = {
  fried: "Fried? Easy wins only tonight.",
  okay: "Okay is plenty. Nothing over 35 minutes.",
  ready: "Ooh, ambitious. Everything’s on the table.",
};

/** Max minutes implied by an energy level (for the wild card request). */
export const ENERGY_MAX_MINUTES: Record<Level, number | null> = {
  fried: 25,
  okay: 35,
  ready: null,
};

function isEasy(r: Recipe) {
  return r.minutes <= 25 || (!!r.tags?.includes("one-pan") && r.ingredients.length <= 10);
}

/**
 * Narrow a roll pool by energy. "Fried" keeps easy dinners and leans toward the
 * fewest steps. If energy would leave nothing, it's ignored (never an error).
 */
export function narrowByEnergy(pool: Recipe[], energy: Energy): { pool: Recipe[]; ignored: boolean } {
  if (!energy || energy === "ready" || !pool.length) return { pool, ignored: false };
  let out: Recipe[];
  if (energy === "okay") {
    out = pool.filter((r) => r.minutes <= 35);
  } else {
    const easy = pool.filter(isEasy);
    // Keep the simpler half (at least 6), including ties at the cutoff.
    const sorted = [...easy].sort((a, b) => a.steps.length - b.steps.length);
    const keep = Math.max(6, Math.ceil(sorted.length / 2));
    const cutoff = sorted[Math.min(keep, sorted.length) - 1]?.steps.length ?? Infinity;
    out = sorted.filter((r) => r.steps.length <= cutoff);
  }
  return out.length ? { pool: out, ignored: false } : { pool, ignored: true };
}

export function EnergyPicker({ ignored, onPick }: { ignored: boolean; onPick?: () => void }) {
  const { energy } = useAppState();

  function pick(v: Level) {
    onPick?.();
    setAppState((s) => ({ ...s, energy: s.energy === v ? null : v }));
  }

  return (
    <div className="px-5">
      <div role="radiogroup" aria-label="Energy tonight" className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const on = energy === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(o.value)}
              className={`flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-2 text-[14px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-95 ${
                on ? "bg-ink text-paper" : "border border-line bg-paper text-ink"
              }`}
            >
              <span className={`text-[26px] leading-none ${on ? "energy-pop" : ""}`}>{o.emoji}</span>
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 min-h-5 text-center text-[14px] font-medium text-muted" aria-live="polite">
        {energy
          ? ignored
            ? "Nothing that easy fits your filters, so any of them is fair game."
            : LINES[energy]
          : "How’s your energy? Or just roll. Both work."}
      </p>
    </div>
  );
}
