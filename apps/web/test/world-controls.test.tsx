import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { input, useKeyboard } from "@/components/stage/world/controls";

const press = (code: string, target: EventTarget = window) => target.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true }));
const release = (code: string) => window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));

afterEach(() => {
  input.kx = input.ky = input.tx = input.ty = input.turn = 0;
  input.run = false;
});

describe("useKeyboard", () => {
  it("walks forward on the up arrow and stops when it is released", () => {
    renderHook(() => useKeyboard(true, () => undefined));
    press("ArrowUp");
    expect(input.ky).toBe(1);
    release("ArrowUp");
    expect(input.ky).toBe(0);
  });

  it("treats WASD like the arrows", () => {
    renderHook(() => useKeyboard(true, () => undefined));
    press("KeyD");
    expect(input.kx).toBe(1);
    release("KeyD");
    press("KeyS");
    expect(input.ky).toBe(-1);
  });

  it("does not move faster on a diagonal", () => {
    renderHook(() => useKeyboard(true, () => undefined));
    press("ArrowUp");
    press("ArrowRight");
    expect(Math.hypot(input.kx, input.ky)).toBeCloseTo(1, 5);
  });

  it("runs with shift and turns the camera with Q and E", () => {
    renderHook(() => useKeyboard(true, () => undefined));
    press("ShiftLeft");
    expect(input.run).toBe(true);
    press("KeyE");
    expect(input.turn).toBe(1);
    press("KeyQ");
    expect(input.turn).toBe(0);
  });

  it("opens the door on Enter or Space, once per press", () => {
    const go = vi.fn();
    renderHook(() => useKeyboard(true, go));
    press("Enter");
    press("Space");
    expect(go).toHaveBeenCalledTimes(2);
  });

  it("stops the arrow keys from scrolling the page", () => {
    renderHook(() => useKeyboard(true, () => undefined));
    const e = new KeyboardEvent("keydown", { code: "ArrowDown", cancelable: true, bubbles: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it("leaves the keys alone while someone is typing, and when inactive", () => {
    const ta = document.createElement("textarea");
    document.body.append(ta);
    const first = renderHook(() => useKeyboard(true, () => undefined));
    press("ArrowUp", ta);
    expect(input.ky).toBe(0);
    ta.remove();
    first.unmount();
    renderHook(() => useKeyboard(false, () => undefined));
    press("ArrowUp");
    expect(input.ky).toBe(0);
  });

  it("lets a focused button handle Enter itself", () => {
    const go = vi.fn();
    const b = document.createElement("button");
    document.body.append(b);
    renderHook(() => useKeyboard(true, go));
    press("Enter", b);
    expect(go).not.toHaveBeenCalled();
    b.remove();
  });

  it("forgets held keys when the window loses focus", () => {
    renderHook(() => useKeyboard(true, () => undefined));
    press("ArrowUp");
    window.dispatchEvent(new Event("blur"));
    expect(input.ky).toBe(0);
  });
});
