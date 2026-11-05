"use client";

import { setAppState, useAppState } from "@/lib/store";
import { TAG_LABELS, type Tag } from "@/lib/types";

/** Tags this row controls. "pasta" has its own chip in FiltersSheet.tsx. */
const FILTER_TAGS: Tag[] = ["veggie-heavy", "one-pan", "kid-friendly", "meal-prep"];

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
      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
        active ? "bg-ink text-paper" : "border border-line bg-paper text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function TagFilter() {
  const app = useAppState();
  const selected = Array.isArray(app.filters.tags) ? app.filters.tags : [];
  const noneOfOurs = !FILTER_TAGS.some((t) => selected.includes(t));

  function toggle(tag: Tag) {
    setAppState((s) => {
      const tags = Array.isArray(s.filters.tags) ? s.filters.tags : [];
      return {
        ...s,
        filters: {
          ...s.filters,
          tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
        },
      };
    });
  }

  function clearOurs() {
    setAppState((s) => ({
      ...s,
      filters: {
        ...s.filters,
        tags: (Array.isArray(s.filters.tags) ? s.filters.tags : []).filter((t) => !FILTER_TAGS.includes(t)),
      },
    }));
  }

  return (
    <div className="flex gap-2 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none]">
      <Chip active={noneOfOurs} onClick={clearOurs}>
        All
      </Chip>
      {FILTER_TAGS.map((tag) => (
        <Chip key={tag} active={selected.includes(tag)} onClick={() => toggle(tag)}>
          {TAG_LABELS[tag]}
        </Chip>
      ))}
    </div>
  );
}
