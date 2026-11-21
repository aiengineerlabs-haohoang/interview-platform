"use client";

import { useEffect, useRef } from "react";

/** Shared movement input. Keyboard and the on-screen pad both write here; the player reads it every frame. */
export const input = { kx: 0, ky: 0, tx: 0, ty: 0, run: false, turn: 0 };

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

const MOVE: Record<string, [number, number]> = {
  ArrowUp: [0, 1], KeyW: [0, 1],
  ArrowDown: [0, -1], KeyS: [0, -1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

/** Arrows or WASD to walk, Shift to run, Q and E to turn the camera, Enter or Space to go through a door. */
export function useKeyboard(active: boolean, onInteract: () => void) {
  const held = useRef(new Set<string>());
  const cb = useRef(onInteract);
  cb.current = onInteract;

  useEffect(() => {
    if (!active) return;
    const h = held.current;
    const recompute = () => {
      let x = 0, y = 0;
      for (const k of h) {
        const m = MOVE[k];
        if (m) { x += m[0]; y += m[1]; }
      }
      const len = Math.hypot(x, y) || 1;
      input.kx = x / len;
      input.ky = y / len;
      input.run = h.has("ShiftLeft") || h.has("ShiftRight");
      input.turn = (h.has("KeyE") ? 1 : 0) - (h.has("KeyQ") ? 1 : 0);
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code in MOVE || e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyQ" || e.code === "KeyE") {
        h.add(e.code);
        if (e.code.startsWith("Arrow")) e.preventDefault();
        recompute();
      } else if ((e.code === "Enter" || e.code === "Space") && !e.repeat) {
        const t = e.target as HTMLElement;
        if (t.tagName === "BUTTON" || t.tagName === "A") return; // let a focused button do its own thing
        e.preventDefault();
        cb.current();
      }
    };
    const up = (e: KeyboardEvent) => {
      h.delete(e.code);
      recompute();
    };
    const blur = () => {
      h.clear();
      recompute();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      h.clear();
      input.kx = input.ky = input.turn = 0;
      input.run = false;
    };
  }, [active]);
}
