"use client";

import { useState } from "react";
import { addToPantry, pantryKey, pantryScore, removeFromPantry } from "@/lib/pantry";
import { PANTRY_SUGGESTIONS } from "@/lib/pantry-suggestions";
import { candidates } from "@/lib/roll";
import { setAppState, useAppState } from "@/lib/store";

export function PantryPanel() {
  const app = useAppState();
  const [draft, setDraft] = useState("");
  const [group, setGroup] = useState(PANTRY_SUGGESTIONS[0]?.group ?? "");

  // older saves could hold non-strings; ignore them
  const pantry = app.pantry.filter((p): p is string => typeof p === "string");
  const keys = new Set(pantry.map(pantryKey));
  const pool = candidates(app.filters, app.dislikes, app.blocked);
  const uses3 = pantry.length ? pool.filter((r) => pantryScore(r, pantry).have.length >= 3).length : 0;
  const uses1 = pantry.length ? pool.filter((r) => pantryScore(r, pantry).have.length >= 1).length : 0;

  function add(entries: string[]) {
    setAppState((s) => ({ ...s, pantry: addToPantry(s.pantry, entries) }));
  }

  function remove(entry: string) {
    setAppState((s) => ({ ...s, pantry: removeFromPantry(s.pantry, entry) }));
  }

  function submit() {
    // "chicken, rice and broccoli" → three items
    const words = draft.split(/,|\s+and\s+|\s*&\s*/i).map((w) => w.trim()).filter(Boolean);
    if (!words.length) return;
    // typing something implies you want pantry mode on
    setAppState((s) => ({ ...s, pantryMode: true, pantry: addToPantry(s.pantry, words) }));
    setDraft("");
  }

  const items = PANTRY_SUGGESTIONS.find((g) => g.group === group)?.items ?? [];

  return (
    <div className="pop-in mt-3 rounded-2xl border border-line bg-paper p-4">
      <button
        type="button"
        onClick={() => setAppState((s) => ({ ...s, pantryMode: !s.pantryMode }))}
        aria-pressed={app.pantryMode}
        className={`w-full rounded-2xl px-3 py-3 text-sm font-semibold ${
          app.pantryMode ? "bg-sage text-paper" : "border border-line bg-paper"
        }`}
      >
        🥫 Pantry mode {app.pantryMode ? "on" : "off"}
      </button>
      <p className="mt-2 text-[13px] leading-snug text-muted">
        Rolls favor dinners that use what you already have. Salt, oil and spices are assumed.
      </p>

      <p className="mt-4 text-sm font-semibold">What’s in the kitchen?</p>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="e.g. chicken, rice, spinach"
          enterKeyHint="done"
          className="min-w-0 flex-1 rounded-xl border border-line bg-cream px-3 py-2 text-[16px] outline-none focus:border-ink/40"
        />
        <button type="button" onClick={submit} className="rounded-xl bg-ink px-4 text-sm font-semibold text-paper">
          Add
        </button>
      </div>

      {PANTRY_SUGGESTIONS.length > 0 && (
        <>
          <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
            {PANTRY_SUGGESTIONS.map((g) => (
              <button
                key={g.group}
                type="button"
                onClick={() => setGroup(g.group)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                  group === g.group ? "bg-butter text-ink" : "text-muted"
                }`}
              >
                {g.group}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {items.map((item) => {
              const on = keys.has(pantryKey(item));
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => (on ? remove(item) : add([item]))}
                  aria-pressed={on}
                  className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                    on ? "bg-ink text-paper" : "border border-line bg-paper text-ink"
                  }`}
                >
                  {on ? "✓ " : "+ "}
                  {item}
                </button>
              );
            })}
          </div>
        </>
      )}

      {pantry.length > 0 && (
        <>
          <div className="mt-4 flex items-baseline justify-between">
            <p className="text-sm font-semibold">In your kitchen</p>
            <button
              type="button"
              onClick={() => setAppState((s) => ({ ...s, pantry: [] }))}
              className="py-1 text-sm text-muted underline underline-offset-4"
            >
              Clear pantry
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {pantry.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => remove(p)}
                className="rounded-full bg-cream px-3 py-1.5 text-sm"
              >
                {p} ✕
              </button>
            ))}
          </div>
          <p className="mt-3 rounded-2xl bg-sage-soft px-4 py-3 text-[14px] font-medium leading-snug text-sage">
            {uses3 > 0
              ? "Nice — plenty of dinners use what you've got"
              : uses1 > 0
                ? "A few dinners use what you've got — add a couple more for better matches"
                : "No dinners in the mix use these yet — try adding a protein or a veggie"}
            {!app.pantryMode && " · turn pantry mode on to use it"}
          </p>
        </>
      )}
    </div>
  );
}
