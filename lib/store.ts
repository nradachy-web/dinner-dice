"use client";

import { useSyncExternalStore } from "react";
import type { Filters, Recipe } from "./types";

export type AppState = {
  favorites: Recipe[];
  /** ids of recently rolled recipes, newest first — avoids repeats */
  recent: string[];
  /** ids the user said "not for me" to */
  blocked: string[];
  /** ingredients to never show, lowercase */
  dislikes: string[];
  filters: Filters;
  wildcard: boolean;
  /** pantry mode: favor recipes that use what's already on hand */
  pantryMode: boolean;
  /** ingredients the user already has, lowercase */
  pantry: string[];
  /** dinners actually cooked, newest first */
  history: CookedEntry[];
  /** the current week plan, or null if none */
  week: WeekPlan | null;
  /** how much energy tonight; narrows the roll. null = not chosen */
  energy: Energy;
  /** roll sounds on/off */
  sound: boolean;
};

export type Energy = "fried" | "okay" | "ready" | null;

export type CookedEntry = {
  id: string;
  title: string;
  emoji: string;
  /** epoch ms */
  at: number;
  /** full recipe kept for wild cards (not in the library) */
  recipe?: Recipe;
};

export type WeekSlot = {
  /** the recipe for this night; null = skipped night */
  recipe: Recipe | null;
  locked: boolean;
};

export type WeekPlan = {
  /** epoch ms the plan was made */
  createdAt: number;
  slots: WeekSlot[];
  /** grocery list items checked off, keyed by consolidated item key */
  checked: string[];
};

const KEY = "dinner-dice:v1";

/** Most cooked entries kept (newest first). */
const HISTORY_CAP = 200;

const DEFAULT: AppState = {
  favorites: [],
  recent: [],
  blocked: [],
  dislikes: [],
  filters: { maxMinutes: null, protein: null },
  wildcard: false,
  pantryMode: false,
  pantry: [],
  history: [],
  week: null,
  energy: null,
  sound: true,
};

let state: AppState | null = null;
const listeners = new Set<() => void>();

const arr = <T>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);

/** Fill in fields missing from older saved versions and drop malformed data. */
function normalize(saved: Partial<AppState>): AppState {
  const history = arr<CookedEntry>(saved.history, [])
    .filter((h) => h && typeof h.id === "string" && typeof h.at === "number" && Number.isFinite(h.at))
    .sort((a, b) => b.at - a.at)
    .slice(0, HISTORY_CAP);
  const filters = saved.filters && typeof saved.filters === "object" ? saved.filters : {};
  const week =
    saved.week && typeof saved.week === "object" && Array.isArray(saved.week.slots)
      ? { ...saved.week, checked: arr<string>(saved.week.checked, []) }
      : null;
  return {
    ...DEFAULT,
    ...saved,
    favorites: arr(saved.favorites, DEFAULT.favorites),
    recent: arr(saved.recent, DEFAULT.recent),
    blocked: arr(saved.blocked, DEFAULT.blocked),
    dislikes: arr(saved.dislikes, DEFAULT.dislikes),
    pantry: arr(saved.pantry, DEFAULT.pantry),
    wildcard: saved.wildcard === true,
    pantryMode: saved.pantryMode === true,
    filters: { ...DEFAULT.filters, ...filters },
    history,
    week,
    energy: saved.energy === "fried" || saved.energy === "okay" || saved.energy === "ready" ? saved.energy : null,
    sound: saved.sound !== false,
  };
}

function load(): AppState {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    const saved: unknown = raw ? JSON.parse(raw) : {};
    state = normalize(saved && typeof saved === "object" ? (saved as Partial<AppState>) : {});
  } catch {
    state = DEFAULT;
  }
  return state;
}

export function setAppState(update: (s: AppState) => AppState) {
  state = update(load());
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or private mode — keep in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Current state outside React (event handlers, helpers). */
export function getAppState(): AppState {
  return load();
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, load, () => DEFAULT);
}

/** Days to avoid re-rolling a dinner after it was cooked. */
export const NO_REPEAT_DAYS = 14;

/** Log a cooked dinner; returns the new entry's timestamp (for Undo). */
export function markCooked(recipe: Recipe): number {
  const at = Date.now();
  setAppState((s) => ({
    ...s,
    history: [
      {
        id: recipe.id,
        title: recipe.title,
        emoji: recipe.emoji,
        at,
        recipe: recipe.source === "wildcard" ? recipe : undefined,
      },
      ...s.history,
    ].slice(0, HISTORY_CAP),
  }));
  return at;
}

/** ids cooked within the last NO_REPEAT_DAYS */
export function recentlyCookedIds(history: CookedEntry[], now = Date.now()): string[] {
  const cutoff = now - NO_REPEAT_DAYS * 86_400_000;
  return history.filter((h) => h.at >= cutoff).map((h) => h.id);
}
