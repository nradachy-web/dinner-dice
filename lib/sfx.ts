"use client";

/**
 * Tiny WebAudio sound effects — no audio files.
 * The AudioContext is created lazily on the first user tap (iOS requires a
 * gesture before audio can play). Every call is a safe no-op if audio is
 * unavailable.
 */

type Ctx = AudioContext;
let ctx: Ctx | null = null;

function getCtx(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

/** Call from a tap handler so iOS lets us play sound later. */
export function unlockAudio() {
  getCtx();
}

function blip(freq: number, at: number, dur: number, gain: number, type: OscillatorType) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Soft wooden "tick" while the die tumbles. Slightly random pitch so it feels alive. */
export function tick() {
  blip(520 + Math.random() * 260, 0, 0.045, 0.06, "triangle");
}

/** Pleasant two-note "ding" when the die lands. */
export function ding() {
  blip(784, 0, 0.5, 0.11, "sine"); // G5
  blip(1047, 0.11, 0.75, 0.1, "sine"); // C6
}

/** Short, quiet sine notes. `notes` are [frequency Hz, start offset s]. */
export function chime(notes: [number, number][], length = 0.12, volume = 0.06) {
  for (const [freq, at] of notes) blip(freq, at, length, volume, "sine");
}

/** Light haptic pulse; silently ignored where unsupported (e.g. iOS Safari). */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
