import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { createApp } from "../src/app";
import type { Deps } from "../src/deps";
import type { Env } from "../src/env";

export const ANON_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const ANON_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

export function client(deps: Partial<Deps> = {}) {
  const app = createApp(deps);
  async function call(path: string, init: RequestInit = {}) {
    const ctx = createExecutionContext();
    const res = await app.request(path, init, env as Env, ctx);
    await waitOnExecutionContext(ctx);
    return res;
  }
  const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    call(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { call, get: (path: string) => call(path), post };
}

/** A clock the test moves by hand. */
export function clock(startIso = "2026-11-21T10:00:00Z") {
  let t = new Date(startIso).getTime();
  return { now: () => t, advance: (ms: number) => (t += ms) };
}
