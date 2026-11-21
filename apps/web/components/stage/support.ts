export type SceneName = "outside" | "lobby" | "room";

/** True when the browser can make a WebGL context at all. Kept apart from Stage so the page does not load three.js to ask. */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
