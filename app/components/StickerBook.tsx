"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RECIPES_BY_ID } from "@/lib/all-recipes";
import { earnedAt, startOfDay, STICKERS, type Sticker } from "@/lib/stickers";
import type { CookedEntry } from "@/lib/store";

function blurb(n: number) {
  if (n === 0) return "Cook any dinner and your first sticker lands here.";
  if (n < 4) return "Off to a tasty start.";
  if (n < 10) return "Look at you go.";
  if (n < 20) return "This book is getting full of flavor.";
  return "Honestly? An impressive sticker book.";
}

/** Tiny, stable tilt so stickers look hand-placed. */
function tilt(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 7) - 3) * 1.5;
}

export function StickerBook({ history }: { history: CookedEntry[] }) {
  const got = useMemo(() => earnedAt(history, RECIPES_BY_ID), [history]);
  const [today] = useState(() => startOfDay(Date.now()));
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Sticker | null>(null);

  // Newest first, so a sticker you just earned is always on the closed page.
  const mine = STICKERS.filter((s) => got.has(s.id)).sort((a, b) => got.get(b.id)! - got.get(a.id)!);
  const mystery = STICKERS.filter((s) => !got.has(s.id));
  // Closed book: up to two rows of earned stickers plus a row of mysteries.
  const shownMine = all ? mine : mine.slice(0, 8);
  const shownMystery = all ? mystery : mystery.slice(0, 4);
  const hidden = mine.length + mystery.length > shownMine.length + shownMystery.length;

  return (
    <section className="mx-5 mt-5 rounded-3xl border border-line bg-paper px-4 pb-4 pt-4">
      <h2 className="font-serif text-[22px] font-semibold leading-tight">Your sticker book</h2>
      <p className="mt-0.5 text-[14px] text-muted">{blurb(mine.length)}</p>

      <ul className="mt-4 grid grid-cols-4 gap-x-2 gap-y-3">
        {shownMine.map((s, i) => (
          <li key={s.id} className="pop-in" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
            <button
              type="button"
              onClick={() => setOpen(s)}
              aria-label={s.name}
              className="flex w-full flex-col items-center gap-1 motion-safe:active:scale-95"
            >
              <span
                className="relative grid h-16 w-16 place-items-center rounded-full border-[3px] border-paper bg-butter text-[34px] shadow-[0_0_0_1px_var(--color-line),0_3px_8px_rgba(31,42,36,.10)]"
                style={{ transform: `rotate(${tilt(s.id)}deg)` }}
              >
                {s.emoji}
                {got.get(s.id)! >= today && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-tomato px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-paper">
                    new
                  </span>
                )}
              </span>
              <span className="line-clamp-3 text-center text-[11px] font-semibold leading-tight text-ink">{s.name}</span>
            </button>
          </li>
        ))}
        {shownMystery.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setOpen(s)}
              aria-label="Mystery sticker"
              className="flex w-full flex-col items-center gap-1 motion-safe:active:scale-95"
            >
              <span className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-line bg-cream">
                <span className="text-[30px] opacity-[0.13] [filter:grayscale(1)_brightness(0)]">{s.emoji}</span>
                <span className="absolute font-serif text-[22px] font-semibold text-muted">?</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {(hidden || all) && (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          className="mt-3 min-h-11 w-full rounded-full text-[14px] font-semibold text-sage active:bg-sage-soft"
        >
          {all ? "Close the book" : "Open the whole book"}
        </button>
      )}

      {open && <StickerSheet sticker={open} isMine={got.has(open.id)} onClose={() => setOpen(null)} />}
    </section>
  );
}

function StickerSheet({ sticker, isMine, onClose }: { sticker: Sticker; isMine: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="sheet-fade fixed inset-0 z-50 flex items-end bg-ink/30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isMine ? sticker.name : "Mystery sticker"}
    >
      <div
        className="sheet-up mx-auto w-full max-w-xl rounded-t-3xl bg-paper px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isMine ? (
          <span
            className="mx-auto grid h-28 w-28 place-items-center rounded-full border-4 border-paper bg-butter text-[60px] shadow-[0_0_0_1px_var(--color-line),0_6px_16px_rgba(31,42,36,.12)]"
            style={{ transform: `rotate(${tilt(sticker.id)}deg)` }}
          >
            {sticker.emoji}
          </span>
        ) : (
          <span className="relative mx-auto grid h-28 w-28 place-items-center rounded-full border-2 border-dashed border-line bg-cream">
            <span className="text-[54px] opacity-[0.13] [filter:grayscale(1)_brightness(0)]">{sticker.emoji}</span>
            <span className="absolute font-serif text-[40px] font-semibold text-muted">?</span>
          </span>
        )}
        <h3 className="mt-4 font-serif text-[26px] font-semibold leading-tight">
          {isMine ? sticker.name : "Mystery sticker"}
        </h3>
        <p className="mx-auto mt-1.5 max-w-[300px] text-[16px] text-muted">
          {isMine ? sticker.description : `Hint: ${sticker.hint}`}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-12 w-full rounded-2xl bg-ink text-[16px] font-semibold text-paper active:scale-[0.99]"
        >
          {isMine ? "Love it" : "Ooh, okay"}
        </button>
      </div>
    </div>,
    document.body
  );
}
