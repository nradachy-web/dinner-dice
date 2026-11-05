"use client";

import { useRef, useState } from "react";
import { GMO_TIP } from "@/lib/gmo";
import { buzz, chime as playChime, unlockAudio } from "@/lib/sfx";
import { candidates } from "@/lib/roll";
import { getAppState, recentlyCookedIds, setAppState, useAppState, type AppState, type WeekPlan } from "@/lib/store";
import type { Recipe } from "@/lib/types";
import {
  NIGHT_OPTIONS,
  formatAmounts,
  groceryList,
  groceryListText,
  nightDate,
  nightLabel,
  rerollSlot,
  resizeWeek,
  rollWeek,
  skipSlot,
  toggleLock,
  type GroceryItem,
  type WeekRollOptions,
} from "@/lib/week";

function rollOptions(app: AppState): WeekRollOptions {
  return {
    recent: app.recent,
    cooked: recentlyCookedIds(app.history),
    pantry: app.pantryMode ? app.pantry : undefined,
  };
}

function isToday(d: Date): boolean {
  return d.toDateString() === new Date().toDateString();
}

/** Copy without the async Clipboard API, which is missing over plain http (phone on the LAN). */
function copyText(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

function setWeek(update: (w: WeekPlan | null, s: AppState) => WeekPlan | null) {
  setAppState((s) => ({ ...s, week: update(s.week, s) }));
}

// ───────────── little bits of feedback (haptics + soft sounds) ─────────────

/** Respects the Sounds switch in Filters. */
function chime(notes: [number, number][], length?: number, volume?: number) {
  if (getAppState().sound) playChime(notes, length, volume);
}

const sounds = {
  tick: () => chime([[880, 0]], 0.08, 0.05),
  untick: () => chime([[520, 0]], 0.07, 0.04),
  roll: () =>
    chime(
      [
        [392, 0],
        [494, 0.06],
        [587, 0.12],
      ],
      0.1,
    ),
  lock: () => chime([[660, 0]], 0.06, 0.05),
  done: () =>
    chime(
      [
        [523, 0],
        [659, 0.1],
        [784, 0.2],
        [1047, 0.3],
      ],
      0.35,
      0.07,
    ),
};

/** Remaining items as calm dots: up to 6, with a soft "+" for more. Never a number. */
function Remaining({ n }: { n: number }) {
  if (n === 0) return <span className="text-sm font-semibold text-sage">✓ all in</span>;
  return (
    <span className="flex items-center gap-1" aria-label={n > 6 ? "lots to grab" : "a few to grab"}>
      {Array.from({ length: Math.min(n, 6) }, (_, i) => (
        <span key={i} className="h-2 w-2 rounded-full bg-tomato/70" />
      ))}
      {n > 6 && <span className="text-xs font-bold leading-none text-tomato/70">+</span>}
    </span>
  );
}

const ANIM_OFF = "motion-reduce:[animation:none]";

export function WeekView({ onOpenRecipe }: { onOpenRecipe: (r: Recipe) => void }) {
  const app = useAppState();
  const week = app.week;
  const [nightsDraft, setNightsDraft] = useState<number>(7);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** night whose ⋯ tray is open */
  const [menu, setMenu] = useState<number | null>(null);
  /** grocery sections the user opened or closed (null = use the default) */
  const [openSections, setOpenSections] = useState<Set<string> | null>(null);
  const [showMore, setShowMore] = useState(false);
  /** null = default: cart open while shopping, folded away once everything's in */
  const [cartOpen, setCartOpen] = useState<boolean | null>(null);
  /** bumps when the whole list gets finished, to replay the celebration */
  const [party, setParty] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nights = week ? week.slots.length : nightsDraft;
  const sections = groceryList(week);
  const checked = new Set(week?.checked ?? []);
  const itemCount = sections.reduce((n, s) => n + s.items.length, 0);
  const checkedCount = sections.reduce((n, s) => n + s.items.filter((i) => checked.has(i.key)).length, 0);
  const allDone = itemCount > 0 && checkedCount === itemCount;
  const progress = itemCount ? checkedCount / itemCount : 0;
  const hasGmo = sections.some((s) => s.items.some((i) => i.gmo && !checked.has(i.key)));
  const toGrab = sections
    .map((s) => ({
      section: s.section,
      items: s.items.filter((i) => !checked.has(i.key)),
    }))
    .filter((s) => s.items.length);
  const inCart: GroceryItem[] = sections.flatMap((s) => s.items.filter((i) => checked.has(i.key)));
  // By default only the first section with things left is open: one place to start.
  const open = openSections ?? new Set(toGrab[0] ? [toGrab[0].section] : []);
  const showCart = cartOpen ?? !allDone;
  const anyLocked = !!week?.slots.some((s) => s.locked);

  function pool(s: AppState) {
    return candidates(s.filters, s.dislikes, s.blocked);
  }

  function flash(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  /** False (with a message) when the filters leave nothing to roll. */
  function hasPool(): boolean {
    if (!pool(app).length) {
      setError("Your filters are a little too picky right now. Loosen them on the Roll tab and come back.");
      return false;
    }
    setError(null);
    return true;
  }

  function rollAll() {
    unlockAudio();
    if (!hasPool()) return;
    setMenu(null);
    buzz([12, 40, 12]);
    sounds.roll();
    setWeek((w, s) => rollWeek(w, nights, pool(s), rollOptions(s)));
  }

  function changeNights(n: number) {
    setNightsDraft(n);
    buzz(8);
    // growing the week needs recipes for the new nights
    if (!week || (n > week.slots.length && !hasPool())) return;
    setMenu(null);
    setWeek((w, s) => (w ? resizeWeek(w, n, pool(s), rollOptions(s)) : w));
  }

  function reroll(i: number) {
    if (!hasPool()) return;
    setMenu(null);
    buzz(12);
    sounds.roll();
    setWeek((w, s) => (w ? rerollSlot(w, i, pool(s), rollOptions(s)) : w));
  }

  function lock(i: number) {
    buzz(15);
    sounds.lock();
    setWeek((w) => (w ? toggleLock(w, i) : w));
  }

  function skip(i: number) {
    setMenu(null);
    buzz(8);
    setWeek((w) => (w ? skipSlot(w, i) : w));
  }

  function toggleChecked(key: string) {
    const on = checked.has(key);
    if (on) {
      buzz(6);
      sounds.untick();
    } else if (checkedCount + 1 === itemCount) {
      buzz([20, 60, 20, 60, 40]);
      sounds.done();
      setParty((p) => p + 1);
    } else {
      buzz(10);
      sounds.tick();
    }
    setWeek((w) => {
      if (!w) return w;
      const done = w.checked ?? [];
      return {
        ...w,
        checked: done.includes(key) ? done.filter((k) => k !== key) : [...done, key],
      };
    });
  }

  function toggleSection(name: string) {
    buzz(5);
    const next = new Set(open);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setOpenSections(next);
  }

  function emptyCart() {
    buzz(8);
    setWeek((w) => (w ? { ...w, checked: [] } : w));
    flash("Cart emptied, list is back");
  }

  function startOver() {
    if (!window.confirm("Start fresh? This clears the week and the grocery list.")) return;
    setNightsDraft(nights);
    setError(null);
    setMenu(null);
    setShowMore(false);
    setOpenSections(null);
    setCartOpen(null);
    setWeek(() => null);
  }

  async function shareList() {
    if (allDone) {
      flash("Everything’s already in the cart 🎉");
      return;
    }
    const text = groceryListText(sections, week?.checked);
    if (navigator.share) {
      try {
        await navigator.share({ title: "This week’s groceries", text });
      } catch {
        /* user cancelled the share sheet */
      }
      return;
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = copyText(text);
    }
    flash(copied ? "Grocery list copied 📋" : "Couldn’t copy the list");
  }

  const nightPicker = (
    <div className="flex items-center justify-center gap-2" role="group" aria-label="How many nights">
      <span className="text-[15px] text-muted">Cooking</span>
      {NIGHT_OPTIONS.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={nights === n}
          aria-label={`${n} nights`}
          onClick={() => changeNights(n)}
          className={`h-11 w-11 rounded-full text-[16px] font-semibold transition-colors ${
            nights === n ? "bg-ink text-paper" : "border border-line bg-paper text-ink"
          }`}
        >
          {n}
        </button>
      ))}
      <span className="text-[15px] text-muted">nights</span>
    </div>
  );

  return (
    <>
      <header className="px-5 pt-2">
        <h1 className="font-serif text-[34px] font-semibold tracking-tight">This week</h1>
        <p className="text-[15px] text-muted">
          {week ? "Tap a night to cook it. 🔒 the ones you love." : "One tap plans it. One trip shops it."}
        </p>
      </header>

      {!week ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <div className={`pop-in text-6xl ${ANIM_OFF}`}>🗓️</div>
          <p className="mt-4 max-w-[19rem] text-[17px] leading-snug text-ink">
            No planning meeting needed. Tap the dice and the week fills itself in.
          </p>
          <p className="mt-1 text-[15px] text-muted">You can swap anything after.</p>
          <button
            type="button"
            onClick={rollAll}
            className="mt-7 w-full rounded-2xl bg-tomato py-5 text-xl font-semibold text-paper shadow-sm transition-transform active:scale-[0.98] active:bg-tomato-dark motion-reduce:transition-none"
          >
            🎲 Plan my week
          </button>
          <div className="mt-4">{nightPicker}</div>
          {error && <p className="mt-3 text-sm font-medium text-tomato-dark">{error}</p>}
        </div>
      ) : (
        <>
          {/* Nights */}
          <ul className="mt-5 space-y-2.5 px-5">
            {week.slots.map((slot, i) => {
              const d = nightDate(week, i);
              const today = isToday(d);
              const day = today ? "Tonight" : nightLabel(week, i);
              const r = slot.recipe;
              const trayOpen = menu === i;
              return (
                <li
                  key={`${i}-${r?.id ?? "skip"}`}
                  className={`pop-in ${ANIM_OFF} overflow-hidden rounded-2xl border bg-paper ${
                    slot.locked ? "border-ink/50" : "border-line"
                  } ${today && r ? "ring-2 ring-tomato/25" : ""}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {r ? (
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => onOpenRecipe(r)}
                        className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-1 text-left"
                      >
                        <span className="text-[34px] leading-none">{r.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-[11px] font-bold uppercase tracking-widest ${
                              today ? "text-tomato" : "text-muted"
                            }`}
                          >
                            {day}
                          </span>
                          <span className="line-clamp-2 font-serif text-[17px] font-semibold leading-tight">
                            {r.title}
                          </span>
                          <span className="block text-[13px] text-muted">
                            {r.minutes} min{r.source === "wildcard" && " · 🃏"}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => lock(i)}
                        aria-label={slot.locked ? `Unlock ${day}` : `Lock ${day}`}
                        aria-pressed={slot.locked}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg transition-colors ${
                          slot.locked ? "bg-ink" : "opacity-40"
                        }`}
                      >
                        {slot.locked ? "🔒" : "🔓"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMenu(trayOpen ? null : i)}
                        aria-label={`More for ${day}`}
                        aria-expanded={trayOpen}
                        className={`mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl font-bold text-muted ${
                          trayOpen ? "bg-cream" : ""
                        }`}
                      >
                        ⋯
                      </button>
                    </div>
                  ) : (
                    <div className="flex min-h-[64px] items-center gap-3 py-2 pl-4 pr-2">
                      <span className="text-[28px] leading-none">🍕</span>
                      <span className="flex-1">
                        <span className="block text-[11px] font-bold uppercase tracking-widest text-muted">
                          {day}
                        </span>
                        <span className="block font-serif text-[17px] text-muted">Night off. Enjoy!</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => reroll(i)}
                        className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold"
                      >
                        ↺ Cook
                      </button>
                    </div>
                  )}
                  {r && trayOpen && (
                    <div
                      className={`pop-in ${ANIM_OFF} flex gap-2 border-t border-line bg-cream/60 px-3 py-2`}
                    >
                      <button
                        type="button"
                        disabled={slot.locked}
                        onClick={() => reroll(i)}
                        className="min-h-11 flex-1 rounded-full border border-line bg-paper text-sm font-semibold disabled:opacity-50"
                      >
                        {slot.locked ? "🔒 Locked in" : "🎲 Swap it"}
                      </button>
                      <button
                        type="button"
                        onClick={() => skip(i)}
                        className="min-h-11 flex-1 rounded-full border border-line bg-paper text-sm font-semibold"
                      >
                        🍕 Night off
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-3 px-5">
            <button
              type="button"
              onClick={rollAll}
              className="w-full rounded-2xl border border-line bg-paper py-3 text-[15px] font-semibold active:scale-[0.99] motion-reduce:transform-none"
            >
              🎲 {anyLocked ? "Re-roll the unlocked nights" : "Re-roll the whole week"}
            </button>
            {error && <p className="mt-2 text-center text-sm font-medium text-tomato-dark">{error}</p>}
          </div>

          {/* Grocery list */}
          <section className="mt-10 px-5" aria-label="Grocery list">
            <h2 className="font-serif text-2xl font-semibold">Groceries</h2>

            {itemCount === 0 ? (
              <p className="mt-2 text-muted">Every night is a night off. Nothing to buy! 🍕</p>
            ) : (
              <>
                <div
                  className="mt-3 h-2.5 overflow-hidden rounded-full bg-sage-soft"
                  role="progressbar"
                  aria-label="Shopping progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                >
                  <div
                    className="h-full rounded-full bg-sage transition-[width] duration-500 ease-out motion-reduce:transition-none"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                {allDone ? (
                  <div
                    key={party}
                    className={`pop-in ${ANIM_OFF} mt-4 rounded-2xl bg-sage-soft px-4 py-4 text-center`}
                  >
                    <div className="text-4xl">🛒✨</div>
                    <p className="mt-1 font-serif text-xl font-semibold text-sage">
                      Shopping: done. Look at you.
                    </p>
                    <p className="mt-0.5 text-sm text-muted">The whole week is in the bag.</p>
                  </div>
                ) : progress >= 0.75 ? (
                  <p className="mt-2 text-[15px] font-semibold text-sage">Almost done!</p>
                ) : checkedCount === 0 ? (
                  <p className="mt-2 text-[15px] text-muted">
                    Start anywhere. Tap things as they go in the cart.
                  </p>
                ) : null}

                {/* Sections still to grab */}
                <div className="mt-4 space-y-2.5">
                  {toGrab.map((s) => {
                    const isOpen = open.has(s.section);
                    return (
                      <div
                        key={s.section}
                        className="overflow-hidden rounded-2xl border border-line bg-paper"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSection(s.section)}
                          aria-expanded={isOpen}
                          className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left"
                        >
                          <span className="flex-1 text-[15px] font-semibold">{s.section}</span>
                          <Remaining n={s.items.length} />
                          <span
                            className={`text-muted transition-transform motion-reduce:transition-none ${
                              isOpen ? "rotate-90" : ""
                            }`}
                          >
                            ›
                          </span>
                        </button>
                        {isOpen && (
                          <ul className="border-t border-line">
                            {s.items.map((item) => {
                              const amount = formatAmounts(item.amounts);
                              return (
                                <li key={item.key} className="border-b border-line last:border-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleChecked(item.key)}
                                    className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-sage-soft"
                                  >
                                    <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 border-line" />
                                    <span className="flex-1 text-[16px] leading-snug">
                                      {amount && <span className="font-semibold">{amount} </span>}
                                      {item.name}
                                      {item.unmeasured && <span className="text-muted"> (to taste)</span>}
                                      {item.gmo && (
                                        <span className="mt-1 block text-[13px] font-medium text-tomato-dark">
                                          ⚠︎ Buy organic / Non-GMO Verified
                                        </span>
                                      )}
                                      <span className="mt-0.5 block text-[13px] text-muted">
                                        {item.recipes.map((r) => r.emoji).join(" ")}{" "}
                                        {item.recipes.length > 1
                                          ? `for ${item.recipes.length} dinners`
                                          : item.recipes[0]?.title}
                                      </span>
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
                {hasGmo && (
                  <p className="mt-2 text-[13px] text-muted">
                    ⚠︎ {GMO_TIP} Everything else is fine conventional or organic.
                  </p>
                )}

                {/* Checked items land here */}
                {inCart.length > 0 && (
                  <div className="mt-6 opacity-80">
                    <button
                      type="button"
                      onClick={() => setCartOpen(!showCart)}
                      aria-expanded={showCart}
                      className="flex min-h-11 w-full items-center gap-2 text-left text-xs font-bold uppercase tracking-widest text-sage"
                    >
                      <span className="flex-1">🛒 In the cart</span>
                      <span
                        className={`text-base text-muted transition-transform motion-reduce:transition-none ${
                          showCart ? "rotate-90" : ""
                        }`}
                      >
                        ›
                      </span>
                    </button>
                    {showCart && (
                      <ul className="overflow-hidden rounded-2xl border border-line bg-paper/60">
                        {inCart.map((item) => {
                          const amount = formatAmounts(item.amounts);
                          return (
                            <li key={item.key} className="border-b border-line last:border-0">
                              <button
                                type="button"
                                onClick={() => toggleChecked(item.key)}
                                aria-label={`Put back ${item.name}`}
                                className={`pop-in ${ANIM_OFF} flex w-full items-center gap-3 px-4 py-2.5 text-left`}
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage text-sm text-paper">
                                  ✓
                                </span>
                                <span className="flex-1 text-[15px] text-muted line-through">
                                  {amount && `${amount} `}
                                  {item.name}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {!allDone && (
                  <button
                    type="button"
                    onClick={shareList}
                    className="mt-6 w-full rounded-2xl border border-ink/15 bg-paper py-3.5 text-[15px] font-semibold"
                  >
                    📝 Send the list to Notes or Messages
                  </button>
                )}
              </>
            )}

            {/* Rarely needed: tucked away until asked for */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                aria-expanded={showMore}
                className="min-h-11 rounded-full px-4 text-sm font-semibold text-muted"
              >
                {showMore ? "Hide options" : "⋯ More options"}
              </button>
            </div>
            {showMore && (
              <div
                className={`pop-in ${ANIM_OFF} mt-2 space-y-3 rounded-2xl border border-line bg-paper p-4`}
              >
                {nightPicker}
                <div className="flex gap-3">
                  {inCart.length > 0 && (
                    <button
                      type="button"
                      onClick={emptyCart}
                      className="min-h-11 flex-1 rounded-2xl border border-line bg-paper py-3 text-[15px] font-semibold"
                    >
                      Empty the cart
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={startOver}
                    className="min-h-11 flex-1 rounded-2xl border border-line bg-paper py-3 text-[15px] font-semibold text-tomato-dark"
                  >
                    Start fresh
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {toast && (
        <div
          role="status"
          className={`pop-in ${ANIM_OFF} fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-30 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper`}
        >
          {toast}
        </div>
      )}
    </>
  );
}
