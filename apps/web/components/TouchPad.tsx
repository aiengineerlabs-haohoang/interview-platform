"use client";

import { useRef, useState } from "react";
import { input } from "./stage/world/controls";

const R = 52;

/** An on-screen stick for touch screens. It writes the same input the arrow keys do. */
export function TouchPad() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const id = useRef<number | null>(null);

  const apply = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setKnob([dx, dy]);
    input.tx = dx / R;
    input.ty = -dy / R;
  };
  const end = () => {
    id.current = null;
    setKnob([0, 0]);
    input.tx = input.ty = 0;
  };

  return (
    <div
      ref={base}
      role="group"
      aria-label="Walking stick"
      className="relative hidden size-32 touch-none select-none rounded-full border border-white/50 bg-black/20 backdrop-blur-sm [@media(pointer:coarse)]:block"
      onPointerDown={(e) => {
        id.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        apply(e);
      }}
      onPointerMove={(e) => id.current === e.pointerId && apply(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="absolute left-1/2 top-1/2 size-14 rounded-full bg-white/80 shadow" style={{ transform: `translate(calc(-50% + ${knob[0]}px), calc(-50% + ${knob[1]}px))` }} />
    </div>
  );
}
