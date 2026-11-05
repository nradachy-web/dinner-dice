"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatClock, formatIngredient } from "@/lib/format";
import { firstMove } from "@/lib/gear";
import { GMO_TIP, isGmoRisk } from "@/lib/gmo";
import { buzz, tick, unlockAudio } from "@/lib/sfx";
import { logCooked, unlogCooked } from "@/lib/stickers";
import { useAppState } from "@/lib/store";
import { PROTEIN_LABELS, type Recipe } from "@/lib/types";
import { Celebrate } from "./Celebrate";
import { CookedButton } from "./CookedButton";
import { GrabFirst } from "./GrabFirst";
import { NutritionBadges } from "./NutritionBadges";
import { PantryMatch } from "./PantryMatch";

type Timer = { endAt: number; total: number; done: boolean };

function useKitchenTimers() {
  const [timers, setTimers] = useState<Record<number, Timer>>({});
  const [now, setNow] = useState(() => Date.now());
  const audioRef = useRef<AudioContext | null>(null);

  const anyRunning = Object.values(timers).some((t) => !t.done);

  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const finished = Object.entries(timers).filter(
        ([, v]) => !v.done && v.endAt <= t
      );
      if (!finished.length) return;
      ring(audioRef.current);
      setTimers((prev) => {
        const next = { ...prev };
        for (const [k] of finished) {
          if (next[Number(k)]) next[Number(k)] = { ...next[Number(k)], done: true };
        }
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [anyRunning, timers]);

  function start(step: number, minutes: number) {
    // Create audio on a tap so iOS lets us beep later.
    if (!audioRef.current) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctx) audioRef.current = new Ctx();
    }
    void audioRef.current?.resume();
    const t = Date.now();
    setNow(t);
    setTimers((p) => ({
      ...p,
      [step]: { endAt: t + minutes * 60_000, total: minutes * 60_000, done: false },
    }));
  }

  function clear(step: number) {
    setTimers((p) => {
      const next = { ...p };
      delete next[step];
      return next;
    });
  }

  return { timers, now, start, clear };
}

function ring(ctx: AudioContext | null) {
  navigator.vibrate?.([300, 150, 300, 150, 300]);
  if (!ctx) return;
  [0, 0.35, 0.7].forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + 0.3);
  });
}

function TimerButton({
  minutes,
  timer,
  now,
  onStart,
  onClear,
  big = false,
}: {
  minutes: number;
  timer?: Timer;
  now: number;
  onStart: () => void;
  onClear: () => void;
  big?: boolean;
}) {
  const size = big ? "px-6 py-4 text-xl" : "px-3 py-1.5 text-sm";
  if (!timer) {
    return (
      <button
        type="button"
        onClick={onStart}
        className={`${size} inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper font-semibold text-ink active:scale-95`}
      >
        ⏱ Start {minutes}-min timer
      </button>
    );
  }
  if (timer.done) {
    return (
      <button
        type="button"
        onClick={onClear}
        className={`${size} timer-done inline-flex items-center gap-2 rounded-full bg-tomato font-semibold text-paper`}
      >
        🔔 Time’s up — tap to dismiss
      </button>
    );
  }
  const left = timer.endAt - now;
  const pct = Math.min(100, Math.max(0, 100 - (left / timer.total) * 100));
  return (
    <button
      type="button"
      onClick={onClear}
      className={`${size} relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-ink font-semibold tabular-nums text-paper`}
    >
      <span
        className="absolute inset-y-0 left-0 bg-sage/60"
        style={{ width: `${pct}%` }}
      />
      <span className="relative">⏱ {formatClock(left)}</span>
      <span className="relative text-paper/60 font-normal">· cancel</span>
    </button>
  );
}

/** Warm send-offs for the end of cook mode. */
const SEND_OFFS = [
  "Leave the dishes for later. Seriously.",
  "Sit down. You earned the good chair.",
  "Real food, made by you. That counts.",
  "Go eat while it’s hot.",
];

/** Permission to keep it easy, based on how long the recipe takes. */
function easyLine(minutes: number) {
  if (minutes <= 25) return "Quick one. Totally doable on a tired night.";
  if (minutes <= 40) return "Mostly hands-off once it’s going.";
  return "A slower one. Put on a podcast and take your time.";
}

function buildListText(recipe: Recipe, servings: number) {
  const scale = servings / recipe.servings;
  const lines = recipe.ingredients.map((i) => {
    const f = formatIngredient(i, scale);
    const gmo = isGmoRisk(i.item) ? " (organic / non-GMO)" : "";
    return `• ${[f.amount, f.item].filter(Boolean).join(" ")}${gmo}`;
  });
  return `${recipe.title} — ${servings} servings\n\n${lines.join("\n")}`;
}

export function RecipeView({
  recipe,
  isFavorite,
  onToggleFavorite,
  onBlock,
  onBack,
}: {
  recipe: Recipe;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onBlock?: () => void;
  onBack: () => void;
}) {
  // Older saved / AI recipes could carry a bad servings count; never divide by 0.
  const baseServings = recipe.servings > 0 ? recipe.servings : 4;
  const [servings, setServings] = useState(baseServings);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [cookStep, setCookStep] = useState<number | null>(null);
  // Inline step-by-step card on the recipe page
  const [stepIdx, setStepIdx] = useState(0);
  const [stepsFinished, setStepsFinished] = useState(false);
  const [showAllSteps, setShowAllSteps] = useState(false);
  // Hide the floating "Start cooking" bar while the steps are on screen,
  // so it never covers the Next arrow.
  const stepsRef = useRef<HTMLElement | null>(null);
  const [stepsInView, setStepsInView] = useState(false);
  useEffect(() => {
    const el = stepsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setStepsInView(e.isIntersecting), {
      rootMargin: "0px 0px -35% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const [prepping, setPrepping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Celebration overlay: null = hidden, "" = no sticker message.
  const [party, setParty] = useState<string | null>(null);
  // History entry created by cook mode's "Done!" (for a quiet Undo).
  const [loggedAt, setLoggedAt] = useState<number | null>(null);
  const [sendOff] = useState(() => SEND_OFFS[Math.floor(Math.random() * SEND_OFFS.length)]);
  const { history, sound } = useAppState();
  const { timers, now, start, clear } = useKitchenTimers();
  const first = useMemo(() => firstMove(recipe), [recipe]);

  const scale = servings / baseServings;
  const hasGmo = recipe.ingredients.some((i) => isGmoRisk(i.item));

  function toggle(set: Set<number>, i: number) {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  }

  /** Move the inline stepper; steps behind you count as done. */
  function goStep(n: number) {
    setDoneSteps((d) => {
      const next = new Set(d);
      for (let k = 0; k < recipe.steps.length; k++) {
        if (k < n) next.add(k);
        else next.delete(k);
      }
      return next;
    });
    setStepIdx(n);
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  /**
   * Cook mode's "Done!": log it and celebrate. Same shared path as CookedButton
   * (lib/stickers logCooked), so a dinner is logged at most once a day.
   */
  function finishCooking() {
    const res = logCooked(recipe, history);
    if (res) setLoggedAt(res.at);
    setParty(res?.message ?? "");
  }

  function undoCooked() {
    if (loggedAt == null) return;
    unlogCooked(recipe.id, loggedAt);
    setLoggedAt(null);
    setParty(null);
  }

  async function shareList() {
    const text = buildListText(recipe, servings);
    try {
      if (navigator.share) {
        await navigator.share({ title: recipe.title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      flash("Grocery list copied");
    } catch {
      /* user cancelled share sheet */
    }
  }

  return (
    <div className="pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-cream/90 px-5 pb-2 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 rounded-full px-2 py-2 text-[15px] font-medium text-muted"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onToggleFavorite}
          className={`rounded-full px-4 py-2 text-[15px] font-semibold ${
            isFavorite ? "bg-tomato text-paper" : "bg-paper text-ink border border-line"
          }`}
        >
          {isFavorite ? "♥ Saved" : "♡ Save"}
        </button>
      </div>

      <header className="pop-in px-5 pt-2">
        <div className="text-6xl">{recipe.emoji}</div>
        <h1 className="mt-3 font-serif text-[32px] font-semibold leading-[1.1] tracking-tight">
          {recipe.title}
        </h1>
        <p className="mt-2 text-[17px] leading-snug text-muted">{recipe.blurb}</p>
        <p className="mt-2 text-[15px] font-medium text-sage">{easyLine(recipe.minutes)}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm font-medium">
          <span className="rounded-full bg-paper border border-line px-3 py-1">
            ⏱ {recipe.minutes} min
          </span>
          <span className="rounded-full bg-paper border border-line px-3 py-1">
            {PROTEIN_LABELS[recipe.protein]}
          </span>
          {recipe.source === "wildcard" && (
            <span className="rounded-full bg-butter px-3 py-1">🃏 Wild card</span>
          )}
        </div>
        <NutritionBadges recipe={recipe} />
        {recipe.why && (
          <p className="mt-4 rounded-2xl bg-sage-soft px-4 py-3 text-[15px] leading-snug text-sage">
            <span className="font-semibold">Why it’s good for you · </span>
            {recipe.why}
          </p>
        )}
        <PantryMatch recipe={recipe} />
      </header>

      {/* Ingredients */}
      <section className="mt-8 px-5">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-2xl font-semibold">Ingredients</h2>
          <div className="flex items-center rounded-full border border-line bg-paper">
            <button
              type="button"
              aria-label="Fewer servings"
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="h-9 w-10 text-xl font-medium"
            >
              −
            </button>
            <span className="min-w-[88px] text-center text-sm font-semibold tabular-nums">
              {servings} serving{servings === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              aria-label="More servings"
              onClick={() => setServings((s) => Math.min(16, s + 1))}
              className="h-9 w-10 text-xl font-medium"
            >
              +
            </button>
          </div>
        </div>

        <ul className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper">
          {recipe.ingredients.map((ing, i) => {
            const f = formatIngredient(ing, scale);
            const on = checked.has(i);
            const gmo = isGmoRisk(ing.item);
            return (
              <li key={i} className="border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() => setChecked((c) => toggle(c, i))}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                      on ? "border-sage bg-sage text-paper" : "border-line"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className={`flex-1 text-[16px] leading-snug ${on ? "text-muted line-through" : ""}`}>
                    {f.amount && <span className="font-semibold">{f.amount} </span>}
                    {f.item}
                    {f.note && <span className="text-muted">, {f.note}</span>}
                    {gmo && (
                      <span className="mt-1 block text-[13px] font-medium text-tomato-dark no-underline">
                        ⚠︎ Buy organic / Non-GMO Verified
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {checked.size > 0 && checked.size >= recipe.ingredients.length && (
          <p className="pop-in mt-2 text-center text-[15px] font-semibold text-sage">Got it all. Nice. 🛒</p>
        )}
        {hasGmo && <p className="mt-2 text-[13px] text-muted">⚠︎ {GMO_TIP} Everything else is fine conventional or organic.</p>}

        <button
          type="button"
          onClick={shareList}
          className="mt-4 w-full rounded-2xl border border-ink/15 bg-paper py-3 text-[15px] font-semibold"
        >
          📝 Send grocery list (Notes, Messages…)
        </button>
      </section>

      {/* Steps — interactive: one step at a time, arrows to move */}
      <section ref={stepsRef} className="mt-10 px-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold">Steps</h2>
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              buzz(10);
              setCookStep(Math.min(stepIdx, recipe.steps.length - 1));
            }}
            className="min-h-11 shrink-0 rounded-full border border-line bg-paper px-4 text-sm font-semibold motion-safe:active:scale-[0.98]"
          >
            ⛶ Full screen
          </button>
        </div>

        {showAllSteps ? (
          <ol className="mt-4 space-y-3">
            {recipe.steps.map((s, i) => {
              const done = doneSteps.has(i);
              return (
                <li key={i} className={`rounded-2xl border border-line bg-paper p-4 ${done ? "opacity-55" : ""}`}>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDoneSteps((d) => toggle(d, i))}
                      aria-label={done ? "Mark step not done" : "Mark step done"}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        done ? "bg-sage text-paper" : "border border-line bg-cream text-ink"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </button>
                    <p className={`pt-1 text-[16px] leading-relaxed ${done ? "line-through" : ""}`}>{s.text}</p>
                  </div>
                  {s.timer && (
                    <div className="mt-3 pl-11">
                      <TimerButton
                        minutes={s.timer}
                        timer={timers[i]}
                        now={now}
                        onStart={() => start(i, s.timer!)}
                        onClear={() => clear(i)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <StepStepper
            recipe={recipe}
            index={stepIdx}
            finished={stepsFinished}
            onGo={goStep}
            onFinish={() => {
              setDoneSteps(new Set(recipe.steps.map((_, k) => k)));
              setStepsFinished(true);
              finishCooking();
            }}
            onRestart={() => {
              setStepsFinished(false);
              setDoneSteps(new Set());
              setStepIdx(0);
            }}
            sound={sound}
            timers={timers}
            now={now}
            startTimer={start}
            clearTimer={clear}
          />
        )}

        <button
          type="button"
          onClick={() => setShowAllSteps((v) => !v)}
          className="mx-auto mt-3 block min-h-11 px-3 text-sm font-medium text-muted underline underline-offset-4"
        >
          {showAllSteps ? "Back to one step at a time" : "See all the steps"}
        </button>

        <div className="mt-8">
          <CookedButton recipe={recipe} />
        </div>

        {onBlock && (
          <button
            type="button"
            onClick={onBlock}
            className="mx-auto mt-8 block text-sm text-muted underline underline-offset-4"
          >
            Not our thing? Skip it from now on
          </button>
        )}
      </section>

      {/* Start cooking */}
      <div
        aria-hidden={stepsInView}
        className={`fixed inset-x-0 bottom-0 z-20 motion-safe:transition-transform motion-safe:duration-300 ${
          stepsInView ? "pointer-events-none translate-y-full" : ""
        } bg-gradient-to-t from-cream via-cream to-cream/0 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-6`}
      >
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            buzz(10);
            setPrepping(true);
          }}
          className="w-full rounded-2xl bg-ink py-3.5 text-paper shadow-lg motion-safe:active:scale-[0.99]"
        >
          <span className="block text-lg font-semibold">👩‍🍳 Start cooking</span>
          <span className="block text-[13px] font-medium text-paper/70">First: {first}</span>
        </button>
      </div>

      {prepping && (
        <GrabFirst
          recipe={recipe}
          onClose={() => setPrepping(false)}
          onStart={() => {
            setPrepping(false);
            setCookStep(0);
          }}
        />
      )}

      {cookStep !== null && (
        <CookMode
          recipe={recipe}
          scale={scale}
          step={cookStep}
          setStep={(n) => {
            setDoneSteps((d) => {
              const next = new Set(d);
              for (let k = 0; k < n; k++) next.add(k);
              return next;
            });
            setCookStep(n);
            if (n < recipe.steps.length) setStepIdx(n);
            else setStepsFinished(true);
          }}
          onClose={() => setCookStep(null)}
          onFinish={finishCooking}
          onUndo={loggedAt != null ? undoCooked : undefined}
          sendOff={sendOff}
          sound={sound}
          timers={timers}
          now={now}
          startTimer={start}
          clearTimer={clear}
        />
      )}

      <Celebrate show={party != null} message={party || undefined} onDone={() => setParty(null)} />

      {toast && (
        <div className="pop-in fixed inset-x-0 bottom-[calc(7.5rem+env(safe-area-inset-bottom))] z-30 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Inline interactive steps: one card, big arrows, swipe, timers. */
function StepStepper({
  recipe,
  index,
  finished,
  onGo,
  onFinish,
  onRestart,
  sound,
  timers,
  now,
  startTimer,
  clearTimer,
}: {
  recipe: Recipe;
  index: number;
  finished: boolean;
  onGo: (n: number) => void;
  onFinish: () => void;
  onRestart: () => void;
  sound: boolean;
  timers: Record<number, Timer>;
  now: number;
  startTimer: (step: number, minutes: number) => void;
  clearTimer: (step: number) => void;
}) {
  const total = recipe.steps.length;
  const isLast = index === total - 1;
  const s = recipe.steps[index];
  const moving = useRef(false);
  const touchX = useRef<number | null>(null);

  function go(n: number) {
    if (moving.current || n < 0 || n >= total) return;
    moving.current = true;
    setTimeout(() => (moving.current = false), 300);
    if (sound) tick();
    buzz(8);
    onGo(n);
  }

  function next() {
    if (moving.current) return;
    if (isLast) onFinish();
    else go(index + 1);
  }

  if (finished) {
    return (
      <div className="pop-in mt-4 rounded-3xl border border-line bg-paper px-5 py-8 text-center">
        <div className="text-5xl" aria-hidden>
          {recipe.emoji}
        </div>
        <p className="mt-3 font-serif text-2xl font-semibold">All steps done. Dinner&rsquo;s ready!</p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-4 min-h-11 px-3 text-sm font-medium text-muted underline underline-offset-4"
        >
          Start the steps over
        </button>
      </div>
    );
  }

  // Timers from other steps keep running; show them so you can hop back.
  const otherTimers = Object.entries(timers).filter(([k]) => Number(k) !== index);

  return (
    <div
      className="mt-4 rounded-3xl border border-line bg-paper p-5 shadow-[0_10px_30px_-18px_rgba(31,42,36,0.35)]"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (dx < -50) next();
        else if (dx > 50) go(index - 1);
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-widest text-tomato">
          {index === 0 ? "Let’s go" : isLast ? "Last bit" : `Step ${index + 1}`}
        </span>
        <StepDots total={total} step={index} />
      </div>

      <p key={index} className="pop-in mt-4 min-h-[5.5rem] font-serif text-[22px] leading-[1.35]">
        {s.text}
      </p>

      {s.timer && (
        <div className="mt-4">
          <TimerButton
            minutes={s.timer}
            timer={timers[index]}
            now={now}
            onStart={() => startTimer(index, s.timer!)}
            onClear={() => clearTimer(index)}
          />
        </div>
      )}

      {otherTimers.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {otherTimers.map(([k, t]) => (
            <button
              key={k}
              type="button"
              onClick={() => (t.done ? clearTimer(Number(k)) : go(Number(k)))}
              className={`min-h-10 rounded-full px-3.5 text-[13px] font-semibold tabular-nums ${
                t.done ? "timer-done bg-tomato text-paper" : "bg-ink text-paper"
              }`}
            >
              Step {Number(k) + 1}: {t.done ? "🔔 done" : formatClock(t.endAt - now)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous step"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-cream text-2xl disabled:opacity-30"
        >
          ←
        </button>
        <button
          type="button"
          onClick={next}
          aria-label={isLast ? "Done" : "Next step"}
          className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-lg font-semibold text-paper motion-safe:active:scale-[0.99] ${
            isLast ? "bg-sage" : "bg-tomato active:bg-tomato-dark"
          }`}
        >
          {isLast ? "Done! 🎉" : <>Next step <span className="text-2xl leading-none">→</span></>}
        </button>
      </div>
    </div>
  );
}

/** Down-arrow connector between step cards — turns sage once the step above is done. */
function StepArrow({ done, big = false }: { done: boolean; big?: boolean }) {
  return (
    <div className={`flex justify-center ${big ? "py-3" : "py-1.5"}`} aria-hidden>
      <svg
        width={big ? 28 : 22}
        height={big ? 34 : 26}
        viewBox="0 0 22 26"
        fill="none"
        className={done ? "text-sage" : "text-ink/30"}
      >
        <path d="M11 1v20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M4 15l7 8 7-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Small progress dots: done = sage, current = tomato (wider), ahead = line. */
function StepDots({ total, step }: { total: number; step: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full motion-safe:transition-all motion-safe:duration-300 ${
            i < step ? "w-2 bg-sage" : i === step ? "w-6 bg-tomato" : "w-2 bg-line"
          }`}
        />
      ))}
    </div>
  );
}

function CookMode({
  recipe,
  scale,
  step,
  setStep,
  onClose,
  onFinish,
  onUndo,
  sendOff,
  sound,
  timers,
  now,
  startTimer,
  clearTimer,
}: {
  recipe: Recipe;
  scale: number;
  step: number;
  setStep: (n: number) => void;
  onClose: () => void;
  onFinish: () => void;
  onUndo?: () => void;
  sendOff: string;
  sound: boolean;
  timers: Record<number, Timer>;
  now: number;
  startTimer: (step: number, minutes: number) => void;
  clearTimer: (step: number) => void;
}) {
  const [showIngredients, setShowIngredients] = useState(false);
  // Brief pause after a step change so a fast double-tap can't skip a step
  // (or hit "Done!" by accident).
  const moving = useRef(false);
  const total = recipe.steps.length;
  const finished = step >= total;
  const isLast = step === total - 1;
  const s = recipe.steps[step];

  // Keep the screen awake while cooking (works on HTTPS / installed app).
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => {
      void lock?.release();
    };
  }, []);

  // Escape closes, like the other sheets.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(n: number) {
    if (moving.current) return;
    moving.current = true;
    setTimeout(() => (moving.current = false), 350);
    setShowIngredients(false);
    setStep(n);
  }

  function next() {
    if (moving.current) return;
    if (isLast) {
      go(total);
      onFinish();
      return;
    }
    if (sound) tick();
    buzz(8);
    go(step + 1);
  }

  // Other steps' timers still running in the background
  const otherTimers = Object.entries(timers).filter(([k]) => Number(k) !== step);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Cooking ${recipe.title}`}
      className="fixed inset-0 z-40 flex flex-col bg-cream pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),12px)]"
    >
      <div className="flex items-center justify-between px-5">
        <button type="button" onClick={onClose} className="-ml-2 min-h-11 px-2 text-[15px] font-medium text-muted">
          ✕ Close
        </button>
        {!finished && (
          <button
            type="button"
            onClick={() => setShowIngredients((v) => !v)}
            className="min-h-11 rounded-full border border-line bg-paper px-4 text-sm font-semibold"
          >
            {showIngredients ? "Back to the step" : "Ingredients"}
          </button>
        )}
      </div>

      {!finished && (
        <div className="mt-3 px-5">
          <StepDots total={total} step={step} />
        </div>
      )}

      {showIngredients && !finished ? (
        <ul className="mt-6 flex-1 overflow-y-auto px-6 text-[17px] leading-relaxed">
          {recipe.ingredients.map((ing, i) => {
            const f = formatIngredient(ing, scale);
            return (
              <li key={i} className="border-b border-line py-2">
                {f.amount && <span className="font-semibold">{f.amount} </span>}
                {f.item}
                {f.note && <span className="text-muted">, {f.note}</span>}
              </li>
            );
          })}
        </ul>
      ) : finished ? (
        <div className="pop-in flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="text-7xl" aria-hidden>
            {recipe.emoji}
          </div>
          <h2 className="mt-4 font-serif text-4xl font-semibold leading-tight">Dinner&rsquo;s ready</h2>
          <p className="mt-3 text-lg text-muted">{sendOff}</p>
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="mt-8 min-h-11 px-3 text-sm text-muted underline underline-offset-4"
            >
              Didn&rsquo;t end up cooking it? Undo
            </button>
          )}
        </div>
      ) : (
        <div key={step} className="pop-in flex flex-1 flex-col justify-center overflow-y-auto px-7">
          {step === 0 && (
            <p className="text-sm font-semibold uppercase tracking-widest text-tomato">Let&rsquo;s go</p>
          )}
          {isLast && total > 1 && (
            <p className="text-sm font-semibold uppercase tracking-widest text-sage">Last bit</p>
          )}
          <p className="mt-3 font-serif text-[30px] leading-[1.25]">{s.text}</p>
          {s.timer && (
            <div className="mt-8">
              <TimerButton
                big
                minutes={s.timer}
                timer={timers[step]}
                now={now}
                onStart={() => startTimer(step, s.timer!)}
                onClear={() => clearTimer(step)}
              />
            </div>
          )}
          {!isLast && recipe.steps[step + 1] && (
            <>
              <StepArrow done={false} big />
              <button
                type="button"
                onClick={next}
                className="rounded-2xl border border-dashed border-line bg-paper/60 px-4 py-3 text-left"
              >
                <span className="block text-[12px] font-semibold uppercase tracking-widest text-muted">Up next</span>
                <span className="mt-1 line-clamp-2 block text-[16px] leading-snug text-ink/60">
                  {recipe.steps[step + 1].text}
                </span>
              </button>
            </>
          )}
        </div>
      )}

      {otherTimers.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {otherTimers.map(([k, t]) => (
            <button
              key={k}
              type="button"
              onClick={() => (t.done ? clearTimer(Number(k)) : go(Number(k)))}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold tabular-nums ${
                t.done ? "timer-done bg-tomato text-paper" : "bg-ink text-paper"
              }`}
            >
              Step {Number(k) + 1}: {t.done ? "🔔 done" : formatClock(t.endAt - now)}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3 px-5 pt-2">
        {finished ? (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-sage py-5 text-xl font-semibold text-paper motion-safe:active:scale-[0.99]"
          >
            Back to the recipe
          </button>
        ) : (
          <>
            {step > 0 && (
              <button
                type="button"
                aria-label="Previous step"
                onClick={() => go(step - 1)}
                className="w-16 shrink-0 rounded-2xl border border-line bg-paper text-2xl font-semibold"
              >
                ←
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className={`flex-1 rounded-2xl py-5 text-xl font-semibold text-paper motion-safe:active:scale-[0.99] ${
                isLast ? "bg-sage active:bg-sage" : "bg-tomato active:bg-tomato-dark"
              }`}
            >
              {isLast ? "Done! 🎉" : "Next →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
