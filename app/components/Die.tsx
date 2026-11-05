"use client";

import { useEffect, useRef } from "react";

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const FACES: { value: number; transform: string }[] = [
  { value: 1, transform: "rotateY(0deg)" },
  { value: 6, transform: "rotateY(180deg)" },
  { value: 3, transform: "rotateY(90deg)" },
  { value: 4, transform: "rotateY(-90deg)" },
  { value: 2, transform: "rotateX(90deg)" },
  { value: 5, transform: "rotateX(-90deg)" },
];

/** Rotation that brings each face to the front. */
export const FACE_ROTATION: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  2: [-90, 0],
  5: [90, 0],
};

/** Squash-and-bounce played when the die lands. */
const LAND: Keyframe[] = [
  { transform: "translateY(0) scale(1, 1)" },
  { transform: "translateY(6px) scale(1.14, 0.84)", offset: 0.22 },
  { transform: "translateY(-10px) scale(0.94, 1.07)", offset: 0.5 },
  { transform: "translateY(0) scale(1.04, 0.97)", offset: 0.75 },
  { transform: "translateY(0) scale(1, 1)" },
];

export function Die({
  rotation,
  rolling,
  landed = 0,
  onClick,
}: {
  rotation: [number, number];
  rolling: boolean;
  /** increments each time the die lands; triggers the bounce */
  landed?: number;
  onClick: () => void;
}) {
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = body.current;
    if (!landed || !el?.animate) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const anim = el.animate(LAND, { duration: 300, easing: "cubic-bezier(0.3, 0.7, 0.4, 1)" });
    return () => anim.cancel();
  }, [landed]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Roll the dice"
      className={`die-scene ${rolling ? "die-rolling" : ""}`}
      disabled={rolling}
    >
      <div ref={body} className="die-body">
        <div
          className="die"
          style={{
            transform: `rotateX(${rotation[0]}deg) rotateY(${rotation[1]}deg)`,
          }}
        >
          {FACES.map((f) => (
            <div
              key={f.value}
              className="die-face"
              style={{ transform: `${f.transform} translateZ(var(--half))` }}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className={PIPS[f.value].includes(i) ? "pip" : "pip pip-off"} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}
