"use client";

import { useRef, useState } from "react";
import { buzz, unlockAudio } from "@/lib/sfx";
import { cookedToday, logCooked, startOfDay, unlogCooked } from "@/lib/stickers";
import { NO_REPEAT_DAYS, useAppState } from "@/lib/store";
import type { Recipe } from "@/lib/types";
import { Celebrate } from "./Celebrate";

const DAY = 86_400_000;
const restDays: number = NO_REPEAT_DAYS;
const restLabel =
  restDays % 7 === 0
    ? `${restDays / 7} week${restDays === 7 ? "" : "s"}`
    : `${restDays} days`;

/** "today", "yesterday", "9 days ago", "3 weeks ago"… */
export function daysAgoLabel(at: number, now: number) {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 21) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export function CookedButton({ recipe }: { recipe: Recipe }) {
  const { history } = useAppState();
  // Timestamp of the entry this button just created (for Undo).
  const [justCooked, setJustCooked] = useState<number | null>(null);
  const busy = useRef(false);
  const [now] = useState(() => Date.now());
  // null = not celebrating; "" = celebrate with no sticker message
  const [party, setParty] = useState<string | null>(null);

  const entries = history.filter((h) => h.id === recipe.id);
  const mine = justCooked != null ? entries.find((e) => e.at === justCooked) : undefined;
  const confirmed = mine != null;
  // Covers a dinner logged from cook mode's "Done!" too: no double logging.
  const doneToday = cookedToday(history, recipe.id, now);
  // "Last made" only for earlier days, so it never repeats what the button already says.
  const last = entries.find((e) => startOfDay(e.at) < startOfDay(now));

  function cook() {
    if (busy.current || confirmed) return;
    busy.current = true;
    unlockAudio();
    buzz(10);
    const res = logCooked(recipe, history);
    if (res) {
      setJustCooked(res.at);
      setParty(res.message);
    }
    setTimeout(() => (busy.current = false), 600);
  }

  function undo() {
    if (!mine) return;
    unlogCooked(recipe.id, mine.at);
    setJustCooked(null);
    setParty(null);
  }

  return (
    <div>
      {confirmed ? (
        <div className="pop-in flex w-full items-center gap-3 rounded-2xl bg-sage-soft px-4 py-3 text-sage">
          <span className="text-xl">✅</span>
          <span className="flex-1 text-[15px] font-semibold leading-snug">
            Fed and done. This one rests for {restLabel}.
          </span>
          <button
            type="button"
            onClick={undo}
            className="min-h-11 shrink-0 rounded-full border border-sage/30 bg-paper px-4 text-sm font-semibold text-sage"
          >
            Undo
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={cook}
          disabled={doneToday}
          className="min-h-12 w-full rounded-2xl border border-ink/15 bg-paper py-3.5 text-[15px] font-semibold motion-safe:active:scale-[0.99] disabled:border-sage/30 disabled:bg-sage-soft disabled:text-sage disabled:active:scale-100"
        >
          {doneToday ? "✅ Cooked today. Nice." : "✅ We cooked this"}
        </button>
      )}
      <Celebrate show={party != null} message={party || undefined} onDone={() => setParty(null)} />
      {last && !confirmed && (
        <p className="mt-2 text-center text-[13px] text-muted">Last made {daysAgoLabel(last.at, now)}</p>
      )}
    </div>
  );
}
