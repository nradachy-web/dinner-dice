"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HAS_AI } from "@/lib/env";
import { Die, FACE_ROTATION } from "./components/Die";
import { ENERGY_MAX_MINUTES, EnergyPicker, narrowByEnergy } from "./components/EnergyPicker";
import { FiltersPill, FiltersSheet, clearFilters, filterSummary } from "./components/FiltersSheet";
import { HistoryView } from "./components/HistoryView";
import { NutritionBadges } from "./components/NutritionBadges";
import { PantryMatch } from "./components/PantryMatch";
import { RecipeView } from "./components/RecipeView";
import { WeekView } from "./components/WeekView";
import { candidates, pickRecipe } from "@/lib/roll";
import { firstMove } from "@/lib/gear";
import { RECIPES } from "@/lib/all-recipes";
import { buzz, ding, tick, unlockAudio } from "@/lib/sfx";
import { recentlyCookedIds, setAppState, useAppState } from "@/lib/store";
import { PROTEIN_LABELS, type Recipe } from "@/lib/types";

type View = "roll" | "recipe" | "week" | "cooked" | "saved";
type ListView = Exclude<View, "recipe">;

const MIN_ROLL_MS = 600;

/** Shown with each result. Warm, never pushy. */
const CHEERS = [
  "Dinner: decided. You’re welcome.",
  "The die has spoken.",
  "One less decision. Nice.",
  "Deciding was the hard part. Done.",
  "Fate says yum.",
  "Look at you, having a plan.",
  "Brain can rest now. Dinner’s picked.",
  "The die is never wrong. Mostly.",
  "Ooh, good one.",
  "That’s tonight sorted.",
  "A fine roll, if the die says so itself.",
  "Picked with love (and randomness).",
];

/** Favorites saved by older versions lack tags/nutrition — use the current library copy. */
function fresh(r: Recipe): Recipe {
  return (r.source === "library" && RECIPES.find((x) => x.id === r.id)) || r;
}

const minOf = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.min(a, b));

export default function Home() {
  const app = useAppState();
  const [view, setView] = useState<View>("roll");
  const [open, setOpen] = useState<Recipe | null>(null);
  const [result, setResult] = useState<Recipe | null>(null);
  const [rolling, setRolling] = useState(false);
  const [shuffleTitle, setShuffleTitle] = useState<string | null>(null);
  const [rotation, setRotation] = useState<[number, number]>([-20, 25]);
  const [landed, setLanded] = useState(0);
  const [cheer, setCheer] = useState(CHEERS[0]);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [returnTo, setReturnTo] = useState<ListView>("roll");
  const lastCheer = useRef(-1);

  // A result from before the filters/energy changed would be misleading: clear it.
  const poolSig = JSON.stringify([app.filters, app.energy, app.pantryMode, app.wildcard, app.dislikes]);
  const [lastSig, setLastSig] = useState(poolSig);
  if (poolSig !== lastSig) {
    setLastSig(poolSig);
    if (!rolling) {
      setResult(null);
      setError(null);
    }
  }

  const byEnergy = narrowByEnergy(candidates(app.filters, app.dislikes, app.blocked), app.energy);
  const pool = byEnergy.pool;
  const noMatch = "Those filters are a little too picky. Loosen one and roll again.";

  /** Decelerating ticks + haptic pulses while the die tumbles. Returns a stop fn. */
  function startTumble(sound: boolean) {
    let delay = 40;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (!alive) return;
      if (sound) tick();
      buzz(8);
      delay = Math.min(delay * 1.22, 160);
      timer = setTimeout(step, delay);
    };
    step();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }

  async function roll() {
    if (rolling) return;
    unlockAudio();
    setError(null);
    setResult(null);
    if (!(HAS_AI && app.wildcard) && !pool.length) {
      buzz(30);
      setError(noMatch);
      return;
    }
    setRolling(true);

    // Spin the die to a random face with a few extra tumbles.
    const face = 1 + Math.floor(Math.random() * 6);
    const [fx, fy] = FACE_ROTATION[face];
    setRotation(([x, y]) => [
      Math.ceil(x / 360) * 360 + 720 + fx,
      Math.ceil(y / 360) * 360 + 1080 + fy,
    ]);
    const stopTumble = startTumble(app.sound);

    // Slot-machine title shuffle while it tumbles
    const names = (pool.length ? pool : RECIPES).map((r) => r.title);
    const shuffler = setInterval(() => {
      setShuffleTitle(names[Math.floor(Math.random() * names.length)]);
    }, 60);

    const started = Date.now();
    let picked: Recipe | null = null;

    if (HAS_AI && app.wildcard) {
      const energyMax = app.energy && !byEnergy.ignored ? ENERGY_MAX_MINUTES[app.energy] : null;
      try {
        const res = await fetch("/api/wildcard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxMinutes: minOf(app.filters.maxMinutes, energyMax),
            protein: app.filters.protein,
            dislikes: app.dislikes,
            tags: app.filters.tags,
            avoidTitles: app.favorites.map((f) => f.title).slice(0, 10),
          }),
        });
        const data = (await res.json()) as { recipe?: Recipe; error?: string };
        if (data.recipe) picked = data.recipe;
        else setError(`${data.error ?? "Wild card failed."} Rolled from your list instead.`);
      } catch {
        setError("Wild card needs internet. Rolled from your list instead.");
      }
    }

    if (!picked)
      picked = pickRecipe(pool, app.recent, {
        cooked: recentlyCookedIds(app.history),
        pantry: app.pantryMode ? app.pantry : undefined,
      });

    const wait = MIN_ROLL_MS - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    clearInterval(shuffler);
    stopTumble();
    setShuffleTitle(null);
    setRolling(false);

    if (!picked) {
      setError(noMatch);
      return;
    }
    // Landing: ding, pop, bounce, and a little cheer.
    if (app.sound) ding();
    buzz([22, 50, 34]);
    setLanded((n) => n + 1);
    let i = Math.floor(Math.random() * CHEERS.length);
    if (i === lastCheer.current) i = (i + 1) % CHEERS.length;
    lastCheer.current = i;
    setCheer(CHEERS[i]);
    setResult(picked);
    if (picked.source === "library") {
      const id = picked.id;
      setAppState((s) => ({
        ...s,
        recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, 12),
      }));
    }
  }

  // Shake-to-roll: keep latest roll() reachable from the motion listener.
  const rollRef = useRef(roll);
  useEffect(() => {
    rollRef.current = roll;
  });

  useEffect(() => {
    if (!shake) return;
    let last = 0;
    let prev: { x: number; y: number; z: number } | null = null;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const cur = { x: a.x, y: a.y, z: a.z };
      if (prev) {
        const delta =
          Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y) + Math.abs(cur.z - prev.z);
        const t = Date.now();
        if (delta > 28 && t - last > 2000) {
          last = t;
          void rollRef.current();
        }
      }
      prev = cur;
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [shake]);

  /** Returns a friendly message if shake couldn't be turned on. */
  async function toggleShake(): Promise<string | null> {
    if (shake) {
      setShake(false);
      return null;
    }
    const DME = (globalThis as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } })
      .DeviceMotionEvent;
    if (!DME || !window.isSecureContext) {
      return "Shake-to-roll needs the installed (https) version of the app. Tap the die for now.";
    }
    if (DME.requestPermission) {
      try {
        const res = await DME.requestPermission();
        if (res !== "granted") return "Motion access was denied. You can still tap the die.";
      } catch {
        return "Couldn’t turn on shake. Tap the die instead.";
      }
    }
    setShake(true);
    buzz(20);
    return null;
  }

  const closeFilters = useCallback(() => setShowFilters(false), []);

  function openRecipe(r: Recipe) {
    if (view !== "recipe") setReturnTo(view);
    setOpen(fresh(r));
    setView("recipe");
    window.scrollTo(0, 0);
  }

  // ───────────── Recipe screen ─────────────
  if (view === "recipe" && open) {
    const isFav = app.favorites.some((f) => f.id === open.id);
    return (
      <main className="mx-auto max-w-xl">
        <RecipeView
          key={open.id}
          recipe={open}
          isFavorite={isFav}
          onToggleFavorite={() =>
            setAppState((s) => ({
              ...s,
              favorites: isFav
                ? s.favorites.filter((f) => f.id !== open.id)
                : [open, ...s.favorites],
            }))
          }
          onBlock={
            open.source === "library"
              ? () => {
                  setAppState((s) => ({
                    ...s,
                    blocked: [...s.blocked, open.id],
                    favorites: s.favorites.filter((f) => f.id !== open.id),
                  }));
                  setResult(null);
                  setView("roll");
                }
              : undefined
          }
          onBack={() => setView(returnTo)}
        />
      </main>
    );
  }

  const showResult = !!result && !rolling;
  const firstStep = result ? firstMove(result) : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col pb-[calc(env(safe-area-inset-bottom)+88px)] pt-[max(env(safe-area-inset-top),16px)]">
      {view === "roll" ? (
        <>
          <header className="px-5 pt-2">
            <h1 className="font-serif text-[34px] font-semibold tracking-tight">Dinner Dice</h1>
          </header>

          <div className="mt-3">
            <EnergyPicker ignored={byEnergy.ignored} onPick={() => buzz(10)} />
          </div>

          {/* Die */}
          <section
            className={`flex flex-1 flex-col items-center justify-center px-5 ${showResult ? "py-2" : "py-8"}`}
          >
            <div className={`transition-transform duration-300 ${showResult ? "-my-8 scale-[0.5]" : ""}`}>
              <Die rotation={rotation} rolling={rolling} landed={landed} onClick={roll} />
            </div>
            <div
              className={`text-center text-[15px] font-medium text-muted ${showResult ? "h-0" : "mt-8 h-7"}`}
              aria-live="polite"
            >
              {rolling ? shuffleTitle : !result && HAS_AI && app.wildcard ? "🃏 Wild card on. AI will invent something." : null}
            </div>

            {showResult && (
              <>
                <p className="pop-in mb-2 mt-3 text-center font-serif text-[18px] font-semibold text-tomato-dark" aria-live="polite">
                  {cheer}
                </p>
                <button
                  type="button"
                  onClick={() => openRecipe(result)}
                  className="pop-in w-full rounded-3xl border border-line bg-paper p-4 text-left shadow-[0_10px_30px_-15px_rgba(31,42,36,0.35)]"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-4xl leading-none">{result.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-serif text-[22px] font-semibold leading-tight">{result.title}</h2>
                      <p className="mt-1 text-[15px] leading-snug text-muted">{result.blurb}</p>
                      <p className="mt-2 text-sm font-semibold">
                        ⏱ {result.minutes} min · {PROTEIN_LABELS[result.protein]}
                        {result.source === "wildcard" && " · 🃏 Wild card"}
                      </p>
                      <NutritionBadges recipe={result} compact />
                      {app.pantryMode && <PantryMatch recipe={result} showNeed={false} />}
                    </div>
                  </div>
                  {firstStep && (
                    <div className="mt-3 rounded-2xl bg-sage-soft px-3.5 py-2.5">
                      <p className="line-clamp-2 text-[14px] leading-snug text-sage">
                        <span className="font-semibold">First tiny step:</span> {firstStep}
                      </p>
                    </div>
                  )}
                  <div className="mt-3 rounded-2xl bg-tomato py-3 text-center text-[16px] font-semibold text-paper">
                    Let’s cook this →
                  </div>
                </button>
              </>
            )}

            {error && (
              <div className="pop-in mt-4 text-center">
                <p className={`text-sm font-medium ${error === noMatch ? "text-tomato-dark" : "text-muted"}`}>{error}</p>
                {error === noMatch && filterSummary(app).length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearFilters();
                      setError(null);
                    }}
                    className="mt-2 min-h-11 rounded-full border border-line bg-paper px-4 text-sm font-semibold"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </section>

          <div className="px-5">
            <button
              type="button"
              onClick={roll}
              disabled={rolling}
              className="w-full rounded-2xl bg-tomato py-4 text-xl font-semibold text-paper shadow-lg transition-transform active:scale-[0.98] active:bg-tomato-dark disabled:opacity-70"
            >
              {rolling ? "Rolling…" : result ? "🎲 Roll again" : "🎲 Roll for dinner"}
            </button>
            <div className="mt-3">
              <FiltersPill onOpen={() => setShowFilters(true)} />
            </div>
          </div>

          <FiltersSheet open={showFilters} onClose={closeFilters} shake={shake} onToggleShake={toggleShake} />
        </>
      ) : view === "week" ? (
        <WeekView onOpenRecipe={openRecipe} />
      ) : view === "cooked" ? (
        <HistoryView onOpenRecipe={openRecipe} />
      ) : (
        <>
          <header className="px-5 pt-2">
            <h1 className="font-serif text-[34px] font-semibold tracking-tight">Saved dinners</h1>
            <p className="text-[15px] text-muted">The keepers. Tap one to cook it again.</p>
          </header>
          {app.favorites.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-10 text-center text-muted">
              <div className="text-5xl">♡</div>
              <p className="mt-3">Roll something you love, then tap Save on the recipe.</p>
            </div>
          ) : (
            <ul className="mt-5 space-y-3 px-5">
              {app.favorites.map(fresh).map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => openRecipe(f)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-line bg-paper p-4 text-left"
                  >
                    <span className="text-4xl">{f.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-serif text-lg font-semibold leading-tight">{f.title}</span>
                      <span className="mt-0.5 block text-sm text-muted">
                        ⏱ {f.minutes} min · {PROTEIN_LABELS[f.protein]}
                        {f.source === "wildcard" && " · 🃏"}
                        {f.nutrition && ` · ≈${f.nutrition.calories} cal`}
                      </span>
                    </span>
                    <span className="text-muted">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-xl">
          {(
            [
              ["roll", "🎲", "Roll"],
              ["week", "🗓️", "Week"],
              ["cooked", "✅", "Cooked"],
              ["saved", "♥", "Saved"],
            ] as const
          ).map(([v, icon, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${
                view === v ? "text-tomato" : "text-muted"
              }`}
            >
              <span className="text-xl leading-none">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
