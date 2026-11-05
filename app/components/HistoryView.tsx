"use client";

import { useState } from "react";
import { RECIPES_BY_ID } from "@/lib/all-recipes";
import { startOfDay, unlogCooked } from "@/lib/stickers";
import { NO_REPEAT_DAYS, useAppState, type CookedEntry } from "@/lib/store";
import type { Recipe } from "@/lib/types";
import { daysAgoLabel } from "./CookedButton";
import { StickerBook } from "./StickerBook";

const DAY = 86_400_000;

/** Monday 00:00 of the week containing `ms`. */
function startOfWeek(ms: number) {
  const d = new Date(startOfDay(ms));
  const offset = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

function groupLabel(at: number, now: number) {
  const thisWeek = startOfWeek(now);
  if (at >= thisWeek) return "This week";
  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);
  if (at >= lastWeek.getTime()) return "Last week";
  const d = new Date(at);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: "long" } : { month: "long", year: "numeric" });
}

function rowDate(at: number, now: number) {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days >= 7) return new Date(at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const label = daysAgoLabel(at, now);
  return label[0].toUpperCase() + label.slice(1);
}

export function HistoryView({ onOpenRecipe }: { onOpenRecipe: (r: Recipe) => void }) {
  const { history } = useAppState();
  const [now] = useState(() => Date.now());

  const restCutoff = now - NO_REPEAT_DAYS * DAY;

  const groups: { label: string; items: CookedEntry[] }[] = [];
  for (const h of history) {
    const label = groupLabel(h.at, now);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(h);
    else groups.push({ label, items: [h] });
  }

  function remove(entry: CookedEntry) {
    unlogCooked(entry.id, entry.at);
  }

  return (
    <>
      <header className="px-5 pt-2">
        <h1 className="font-serif text-[34px] font-semibold tracking-tight">Cooked</h1>
        <p className="text-[15px] text-muted">Every dinner you made. Each one counts.</p>
      </header>

      <StickerBook history={history} />

      {history.length === 0 ? (
        <p className="mt-6 px-10 text-center text-[15px] text-muted">
          Finished dinners land here. No pressure, no schedule.
        </p>
      ) : (
        <>
          <div className="mt-6 space-y-6 px-5">
            {groups.map((g) => (
              <section key={g.label} className="pop-in">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</h2>
                <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
                  {g.items.map((h) => {
                    const recipe = RECIPES_BY_ID[h.id] ?? h.recipe;
                    const resting = h.at >= restCutoff;
                    return (
                      <li key={`${h.id}-${h.at}`} className="flex items-center">
                        <button
                          type="button"
                          disabled={!recipe}
                          onClick={() => recipe && onOpenRecipe(recipe)}
                          className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left disabled:opacity-50"
                        >
                          <span className="text-3xl">{h.emoji}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-serif text-[17px] font-semibold leading-tight">
                              {h.title}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                              <span className="whitespace-nowrap">{rowDate(h.at, now)}</span>
                              {resting && (
                                <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[11px] font-semibold text-sage">
                                  resting 💤
                                </span>
                              )}
                              {!recipe && <span className="whitespace-nowrap text-[12px]">· no longer available</span>}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(h)}
                          aria-label={`Remove ${h.title} from history`}
                          className="grid h-12 w-12 shrink-0 place-items-center text-lg text-muted active:text-ink"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <p className="text-center text-[13px] text-muted">
              Resting dinners nap for {NO_REPEAT_DAYS} days so the die can surprise you.
            </p>
          </div>
        </>
      )}
    </>
  );
}
