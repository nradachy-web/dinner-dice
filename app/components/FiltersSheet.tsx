"use client";

import { useEffect, useState } from "react";
import { HAS_AI } from "@/lib/env";
import { PantryPanel } from "./PantryPanel";
import { TagFilter } from "./TagFilter";
import { setAppState, useAppState, type AppState } from "@/lib/store";
import { PROTEIN_LABELS, TAG_LABELS, type Protein } from "@/lib/types";

const TIME_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Any", value: null },
  { label: "≤ 20 min", value: 20 },
  { label: "≤ 30 min", value: 30 },
  { label: "≤ 40 min", value: 40 },
];

const PROTEINS = Object.keys(PROTEIN_LABELS) as Protein[];

/** Strip the leading emoji from a tag label ("🍳 One-pan" → "One-pan"). */
const plain = (label: string) => label.replace(/^\S+\s/, "");

/** Short words for what's narrowing the roll, e.g. ["Chicken", "≤30 min"]. */
export function filterSummary(app: AppState): string[] {
  const out: string[] = [];
  if (app.filters.protein) out.push(PROTEIN_LABELS[app.filters.protein]);
  if (app.filters.maxMinutes != null) out.push(`≤${app.filters.maxMinutes} min`);
  for (const t of app.filters.tags ?? []) if (TAG_LABELS[t]) out.push(plain(TAG_LABELS[t]));
  if (app.pantryMode) out.push("Pantry");
  if (HAS_AI && app.wildcard) out.push("Wild card");
  return out;
}

/** Clears the roll filters. Keeps dislikes, pantry items and settings. */
export function clearFilters() {
  setAppState((s) => ({
    ...s,
    filters: { maxMinutes: null, protein: null, tags: [] },
    pantryMode: false,
    wildcard: false,
  }));
}

/** The one small "Filters" pill on the roll screen. */
export function FiltersPill({ onOpen }: { onOpen: () => void }) {
  const app = useAppState();
  const bits = filterSummary(app);
  const text = bits.length > 2 ? `${bits.slice(0, 2).join(", ")} +` : bits.join(", ");
  return (
    <div className="flex justify-center">
      <div
        className={`flex max-w-full items-center rounded-full text-sm font-semibold ${
          bits.length ? "bg-ink text-paper" : "border border-line bg-paper text-ink"
        }`}
      >
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          className={`min-h-11 min-w-0 truncate py-2.5 ${bits.length ? "pl-4 pr-1" : "px-5"}`}
        >
          {bits.length ? `Filters · ${text}` : "⚙︎ Filters"}
        </button>
        {bits.length > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            aria-label="Clear filters"
            className="grid min-h-11 w-10 shrink-0 place-items-center rounded-full text-paper/80"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
        active ? "bg-ink text-paper" : "border border-line bg-paper text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  on,
  onClick,
  emoji,
  label,
  hint,
}: {
  on: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-5 py-2.5 text-left"
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="block text-[13px] leading-snug text-muted">{hint}</span>
      </span>
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-sage" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-paper shadow transition-[left] duration-150 ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function Expander({
  open,
  onClick,
  emoji,
  label,
  hint,
}: {
  open: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-5 py-2.5 text-left"
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="block text-[13px] leading-snug text-muted">{hint}</span>
      </span>
      <span aria-hidden className={`text-lg text-muted transition-transform ${open ? "rotate-90" : ""}`}>
        ›
      </span>
    </button>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="px-5 text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</p>
);

export function FiltersSheet({
  open,
  onClose,
  shake,
  onToggleShake,
}: {
  open: boolean;
  onClose: () => void;
  shake: boolean;
  /** resolves to a friendly message if shake couldn't be turned on */
  onToggleShake: () => Promise<string | null>;
}) {
  const app = useAppState();
  const [section, setSection] = useState<"pantry" | "skip" | null>(null);
  const [dislikeDraft, setDislikeDraft] = useState("");
  const [shakeNote, setShakeNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const setFilters = (f: Partial<AppState["filters"]>) =>
    setAppState((s) => ({ ...s, filters: { ...s.filters, ...f } }));

  function togglePasta() {
    setAppState((s) => {
      const tags = s.filters.tags ?? [];
      return {
        ...s,
        filters: {
          ...s.filters,
          tags: tags.includes("pasta") ? tags.filter((t) => t !== "pasta") : [...tags, "pasta"],
        },
      };
    });
  }

  function addDislike() {
    const words = dislikeDraft
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    if (!words.length) return;
    setAppState((s) => ({ ...s, dislikes: Array.from(new Set([...s.dislikes, ...words])) }));
    setDislikeDraft("");
  }

  const active = filterSummary(app).length > 0;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Filters">
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="sheet-fade absolute inset-0 bg-ink/30"
      />
      <div className="sheet-up absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] max-w-xl flex-col rounded-t-[28px] bg-cream shadow-[0_-12px_40px_-12px_rgba(31,42,36,0.35)]">
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <div className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-line" />
          <h2 className="mt-2 font-serif text-[24px] font-semibold">Filters</h2>
          <div className="mt-2 flex items-center gap-1">
            {active && (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 px-3 text-sm font-semibold text-muted underline underline-offset-4"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-paper"
            >
              Done
            </button>
          </div>
        </div>

        <div className="overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+20px)]">
          <div className="space-y-2.5 pt-2">
            <Label>Time</Label>
            <div className="grid grid-cols-4 gap-2 px-5 [&>button]:px-1">
              {TIME_OPTIONS.map((o) => (
                <Chip
                  key={o.label}
                  active={app.filters.maxMinutes === o.value}
                  onClick={() => setFilters({ maxMinutes: o.value })}
                >
                  {o.label}
                </Chip>
              ))}
            </div>

            <div className="pt-2">
              <Label>Protein</Label>
            </div>
            <div className="flex flex-wrap gap-2 px-5">
              <Chip active={app.filters.protein === null} onClick={() => setFilters({ protein: null })}>
                Any
              </Chip>
              {PROTEINS.map((p) => (
                <Chip key={p} active={app.filters.protein === p} onClick={() => setFilters({ protein: p })}>
                  {PROTEIN_LABELS[p]}
                </Chip>
              ))}
              <Chip active={!!app.filters.tags?.includes("pasta")} onClick={togglePasta}>
                🍝 Pasta
              </Chip>
            </div>

            <div className="pt-2">
              <Label>Kind of dinner</Label>
            </div>
            <div className="[&>div]:flex-wrap">
              <TagFilter />
            </div>
          </div>

          <div className="mx-5 mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
            {HAS_AI && <Toggle
              on={app.wildcard}
              onClick={() => setAppState((s) => ({ ...s, wildcard: !s.wildcard }))}
              emoji="🃏"
              label="Wild card"
              hint="AI invents something brand new"
            />}
            <div>
              <Toggle
                on={shake}
                onClick={async () => setShakeNote(await onToggleShake())}
                emoji="📳"
                label="Shake to roll"
                hint="Shake the phone instead of tapping"
              />
              {shakeNote && (
                <p className="px-5 pb-3 text-[13px] font-medium text-tomato-dark">{shakeNote}</p>
              )}
            </div>
            <Toggle
              on={app.sound}
              onClick={() => setAppState((s) => ({ ...s, sound: !s.sound }))}
              emoji={app.sound ? "🔊" : "🔈"}
              label="Sounds"
              hint="Little clicks, dings and chimes"
            />
            <div>
              <Expander
                open={section === "pantry"}
                onClick={() => setSection((v) => (v === "pantry" ? null : "pantry"))}
                emoji="🥫"
                label={`Pantry${app.pantryMode ? " · on" : ""}`}
                hint="Favor dinners that use what you have"
              />
              {section === "pantry" && (
                <div className="px-2 pb-2 [&>div]:mt-0 [&>div]:border-0 [&>div]:pt-1">
                  <PantryPanel />
                </div>
              )}
            </div>
            <div>
              <Expander
                open={section === "skip"}
                onClick={() => setSection((v) => (v === "skip" ? null : "skip"))}
                emoji="🚫"
                label="Never show me…"
                hint="Ingredients you'd rather skip"
              />
              {section === "skip" && (
                <div className="pop-in px-5 pb-4">
                  <div className="flex gap-2">
                    <input
                      value={dislikeDraft}
                      onChange={(e) => setDislikeDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addDislike()}
                      placeholder="e.g. olives, mushrooms"
                      enterKeyHint="done"
                      className="min-w-0 flex-1 rounded-xl border border-line bg-cream px-3 py-2 text-[16px] outline-none focus:border-ink/40"
                    />
                    <button
                      type="button"
                      onClick={addDislike}
                      className="min-h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-paper"
                    >
                      Add
                    </button>
                  </div>
                  {app.dislikes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {app.dislikes.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setAppState((s) => ({ ...s, dislikes: s.dislikes.filter((x) => x !== d) }))}
                          className="rounded-full bg-cream px-3 py-1.5 text-sm"
                        >
                          {d} ✕
                        </button>
                      ))}
                    </div>
                  )}
                  {app.blocked.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAppState((s) => ({ ...s, blocked: [] }))}
                      className="mt-3 py-1 text-sm text-muted underline underline-offset-4"
                    >
                      Bring back the “not for me” recipes
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
