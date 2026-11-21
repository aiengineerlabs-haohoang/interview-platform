export interface Deps {
  /** Milliseconds since the epoch. Tests move it by hand. */
  now: () => number;
  requestId: () => string;
}

export const defaultDeps: Deps = {
  now: () => Date.now(),
  requestId: () => crypto.randomUUID(),
};
