"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { grabList } from "@/lib/gear";
import { useAppState } from "@/lib/store";
import type { Recipe } from "@/lib/types";

/** Tiny tap feedback: a short haptic + a soft WebAudio blip (blip only when sounds are on). */
export function useBlip(sound = true) {
  const ctxRef = useRef<AudioContext | null>(null);
  return function blip(freq = 660, ms = 90, buzz: number | number[] = 8) {
    try {
      navigator.vibrate?.(buzz);
    } catch {
      /* no haptics */
    }
    if (!sound) return;
    try {
      if (!ctxRef.current) {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        ctxRef.current = new Ctx();
      }
      const ctx = ctxRef.current;
      void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, t + ms / 1000);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.02);
    } catch {
      /* audio is a nice-to-have */
    }
  };
}

function Chip({
  on,
  onClick,
  emoji,
  children,
}: {
  on: boolean;
  onClick: () => void;
  emoji?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-2 text-left text-[15px] font-medium leading-tight transition-colors motion-safe:transition motion-safe:active:scale-95 ${
        on ? "border-sage bg-sage text-paper" : "border-line bg-paper text-ink"
      }`}
    >
      {on ? <span aria-hidden>✓</span> : emoji && <span aria-hidden>{emoji}</span>}
      {children}
    </button>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">{children}</h3>;
}

/**
 * "Grab these first": a quick lap around the kitchen before cooking.
 * Everything is optional to tick; the button always works.
 */
export function GrabFirst({
  recipe,
  onStart,
  onClose,
}: {
  recipe: Recipe;
  onStart: () => void;
  onClose: () => void;
}) {
  const list = useMemo(() => grabList(recipe), [recipe]);
  const [got, setGot] = useState<Set<string>>(new Set());
  const { sound } = useAppState();
  const blip = useBlip(sound);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const keys = [
    ...(list.oven ? ["oven"] : []),
    ...list.gear.map((g) => `gear:${g.id}`),
    ...list.fridge.map((f) => `ing:${f.index}`),
    ...list.pantry.map((p) => `ing:${p.index}`),
  ];
  const fill = keys.length ? got.size / keys.length : 0;
  const allSet = keys.length > 0 && got.size >= keys.length;

  function toggle(key: string) {
    const next = new Set(got);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      // Pitch climbs a little as the list fills: a tiny "getting there" cue.
      const done = next.size >= keys.length;
      blip(520 + (next.size / Math.max(1, keys.length)) * 360, done ? 160 : 80, done ? [10, 40, 18] : 8);
    }
    setGot(next);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Grab these first"
      className="fixed inset-0 z-40 flex flex-col bg-cream pt-[max(env(safe-area-inset-top),12px)]"
    >
      <div className="flex items-center justify-between px-5">
        <button
          type="button"
          onClick={onClose}
          className="-ml-2 min-h-11 px-2 text-[15px] font-medium text-muted"
        >
          ✕ Not yet
        </button>
        <span className="text-2xl" aria-hidden>
          {recipe.emoji}
        </span>
      </div>

      {/* Gentle fill, no numbers */}
      <div className="mx-5 mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-sage motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${Math.round(fill * 100)}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-5">
        <h2 className="font-serif text-[30px] font-semibold leading-tight">Grab these first</h2>
        <p className="mt-1 text-[16px] text-muted">
          One quick lap around the kitchen. Tap things as you go, or don&rsquo;t.
        </p>

        {list.oven && (
          <button
            type="button"
            aria-pressed={got.has("oven")}
            onClick={() => toggle("oven")}
            className={`mt-5 flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left motion-safe:transition-transform motion-safe:active:scale-[0.98] ${
              got.has("oven") ? "border-sage bg-sage text-paper" : "border-tomato/30 bg-paper"
            }`}
          >
            <span className="text-2xl" aria-hidden>
              {got.has("oven") ? "✓" : "🔥"}
            </span>
            <span className="flex-1">
              <span className="block text-lg font-semibold">{list.oven.label}</span>
              <span className={`block text-sm ${got.has("oven") ? "text-paper/80" : "text-muted"}`}>
                {got.has("oven") ? "It’s warming up while you do the rest." : "Do this first. It heats while you grab stuff."}
              </span>
            </span>
          </button>
        )}

        {list.gear.length > 0 && (
          <section className="mt-6">
            <Heading>Cookware</Heading>
            <div className="mt-2 flex flex-wrap gap-2">
              {list.gear.map((g) => (
                <Chip key={g.id} on={got.has(`gear:${g.id}`)} onClick={() => toggle(`gear:${g.id}`)} emoji={g.emoji}>
                  {g.label}
                </Chip>
              ))}
            </div>
          </section>
        )}

        {(list.fridge.length > 0 || list.pantry.length > 0) && (
          <section className="mt-6">
            <Heading>Pull out</Heading>
            {list.fridge.length > 0 && (
              <>
                <p className="mt-2 text-[15px] font-semibold">🧊 Fridge</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {list.fridge.map((f) => (
                    <Chip key={f.index} on={got.has(`ing:${f.index}`)} onClick={() => toggle(`ing:${f.index}`)}>
                      {f.label}
                    </Chip>
                  ))}
                </div>
              </>
            )}
            {list.pantry.length > 0 && (
              <>
                <p className="mt-4 text-[15px] font-semibold">🫙 Pantry &amp; counter</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {list.pantry.map((p) => (
                    <Chip key={p.index} on={got.has(`ing:${p.index}`)} onClick={() => toggle(`ing:${p.index}`)}>
                      {p.label}
                    </Chip>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </div>

      <div className="border-t border-line bg-cream px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
        <p
          aria-live="polite"
          className={`mb-2 text-center text-[15px] font-semibold text-sage ${allSet ? "pop-in" : "invisible"}`}
        >
          All set. You&rsquo;re basically cooking already.
        </p>
        <button
          type="button"
          onClick={() => {
            blip(784, 140, [12, 30, 12]);
            onStart();
          }}
          className="w-full rounded-2xl bg-tomato py-4 text-lg font-semibold text-paper shadow-lg active:bg-tomato-dark motion-safe:active:scale-[0.99]"
        >
          I&rsquo;ve got everything → Start cooking
        </button>
      </div>
    </div>
  );
}
