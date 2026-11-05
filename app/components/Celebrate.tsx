"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ding } from "@/lib/sfx";
import { useAppState } from "@/lib/store";

const COLORS = ["#d9512c", "#f4e3b5", "#4f7d5c", "#1f2a24"]; // tomato, butter, sage, ink
const PIECES = 34;

const LINES = [
  "Dinner: done.",
  "You fed the people!",
  "Look at you, cooking.",
  "Dinner happened!",
  "Chef's kiss.",
];

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function pop() {
  try {
    navigator.vibrate?.([14, 50, 22]);
  } catch {
    /* no haptics */
  }
}

/**
 * Full-screen, non-blocking celebration (~1.6s; a bit longer when there's a
 * sticker message to read). Taps pass straight through it. Respects the
 * Sounds switch and prefers-reduced-motion (fade only, no confetti).
 */
export function Celebrate({ show, onDone, message }: { show: boolean; onDone: () => void; message?: string }) {
  const { sound } = useAppState();
  const doneRef = useRef(onDone);
  const soundRef = useRef(sound);
  useEffect(() => {
    doneRef.current = onDone;
    soundRef.current = sound;
  });

  useEffect(() => {
    if (!show) return;
    pop();
    // Shared AudioContext from lib/sfx: it was unlocked by the tap that got us here,
    // so this plays on iOS too (a fresh context created here would start muted).
    if (soundRef.current) ding();
    const t = setTimeout(() => doneRef.current(), message ? 2400 : 1600);
    return () => clearTimeout(t);
  }, [show, message]);

  if (!show || typeof document === "undefined") return null;
  return createPortal(<Burst message={message} long={!!message} />, document.body);
}

function Burst({ message, long }: { message?: string; long: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [line] = useState(() => LINES[Math.floor(Math.random() * LINES.length)]);
  const [pieces] = useState(() =>
    Array.from({ length: PIECES }, (_, i) => {
      const angle = (i / PIECES) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 150 + Math.random() * 120;
      return {
        color: COLORS[i % COLORS.length],
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist * 0.8 - 40,
        fall: 160 + Math.random() * 120,
        spin: (Math.random() - 0.5) * 720,
        w: 8 + Math.round(Math.random() * 5),
        round: i % 3 === 0,
        delay: Math.random() * 80,
      };
    })
  );

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const total = long ? 2400 : 1600;
    const still = reducedMotion();
    el.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }],
      { duration: total, fill: "forwards" }
    );
    const card = el.querySelector<HTMLElement>("[data-card]");
    if (card && !still) {
      card.animate(
        [
          { transform: "scale(0.6)", opacity: 0 },
          { transform: "scale(1.06)", opacity: 1, offset: 0.55 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 420, easing: "cubic-bezier(.2,.8,.3,1.2)", fill: "backwards" }
      );
    }
    if (still) return;
    el.querySelectorAll<HTMLElement>("[data-bit]").forEach((bit, i) => {
      const p = pieces[i];
      bit.animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${p.dx}px, ${p.dy}px) rotate(${p.spin / 2}deg)`, opacity: 1, offset: 0.4 },
          { opacity: 1, offset: 0.75 },
          { transform: `translate(${p.dx * 1.1}px, ${p.dy + p.fall}px) rotate(${p.spin}deg)`, opacity: 0 },
        ],
        { duration: 1400, delay: p.delay, easing: "cubic-bezier(.15,.7,.4,1)", fill: "both" }
      );
    });
  }, [pieces, long]);

  return (
    <div
      ref={root}
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-cream/40 opacity-0"
    >
      <div
        data-card
        className="relative mx-8 max-w-[300px] rounded-3xl border border-line bg-paper px-6 py-5 text-center shadow-[0_12px_40px_rgba(31,42,36,.14)]"
      >
        <div className="text-5xl leading-none">🎉</div>
        <p className="mt-3 font-serif text-[26px] font-semibold leading-tight tracking-tight text-ink">{line}</p>
        {message && (
          <p className="mt-2 rounded-2xl bg-butter px-3 py-1.5 text-[15px] font-semibold text-ink">{message}</p>
        )}
      </div>
      <div className="absolute left-1/2 top-[44%] z-10 h-0 w-0">
        {!reducedMotion() &&
          pieces.map((p, i) => (
            <span
              key={i}
              data-bit
              className="absolute block"
              style={{
                width: p.w,
                height: p.round ? p.w : p.w * 1.8,
                marginLeft: -p.w / 2,
                background: p.color,
                borderRadius: p.round ? 999 : 2,
                outline: p.color === COLORS[1] ? "1px solid rgba(31,42,36,.12)" : undefined,
              }}
            />
          ))}
      </div>
    </div>
  );
}
