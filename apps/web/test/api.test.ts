import { describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("api client", () => {
  it("parses a good presence response", async () => {
    const f = vi.fn(() => json({ online: 3, rooms: { agents: 2 }, visitors: [{ avatar: "owl", room: null }] }));
    expect(await api.presence(f as unknown as typeof fetch)).toEqual({ online: 3, rooms: { agents: 2 }, visitors: [{ avatar: "owl", room: null }] });
  });

  it("posts a heartbeat as JSON", async () => {
    const f = vi.fn((_u: string, _i?: RequestInit) => json({ online: 1, rooms: {}, visitors: [] }));
    await api.heartbeat({ anonId: "a".repeat(32), room: "agents", avatar: "fox" }, f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("/api/presence");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ anonId: "a".repeat(32), room: "agents", avatar: "fox" });
  });

  it("returns null, not an exception, when the network is down", async () => {
    const f = vi.fn(() => Promise.reject(new TypeError("offline")));
    expect(await api.daily(f as unknown as typeof fetch)).toBeNull();
  });

  it("returns null on a server error", async () => {
    expect(await api.daily((() => json({ error: {} }, 500)) as unknown as typeof fetch)).toBeNull();
  });

  it("returns null when the server answers with the wrong shape", async () => {
    expect(await api.daily((() => json({ day: 5 })) as unknown as typeof fetch)).toBeNull();
  });
});

describe("auth client", () => {
  const user = { id: "u1", username: "hao", avatar: { model: "kai", hue: 10 } };
  const calls = (f: ReturnType<typeof vi.fn>) => f.mock.calls as unknown as [string, RequestInit][];

  it("me() sends credentials and returns the user, or null when signed out", async () => {
    const f = vi.fn((_u: string, _i?: RequestInit) => json({ user }));
    expect(await api.me(f as unknown as typeof fetch)).toEqual({ user });
    expect(calls(f)[0]![1].credentials).toBe("same-origin");
    expect(await api.me((() => json({ user: null })) as unknown as typeof fetch)).toEqual({ user: null });
  });

  it("me() is null when the API is unreachable", async () => {
    expect(await api.me((() => Promise.reject(new TypeError("offline"))) as unknown as typeof fetch)).toBeNull();
  });

  it("register() posts JSON and returns the user", async () => {
    const f = vi.fn((_u: string, _i?: RequestInit) => json({ user }, 201));
    const r = await api.register({ username: "hao", password: "password1", anonId: "a".repeat(32) }, f as unknown as typeof fetch);
    expect(r).toEqual({ ok: true, user });
    expect(calls(f)[0]![0]).toBe("/api/auth/register");
    expect(JSON.parse(calls(f)[0]![1].body as string)).toEqual({ username: "hao", password: "password1", anonId: "a".repeat(32) });
  });

  it("explains a taken username, a bad login and an offline server", async () => {
    expect(await api.register({ username: "hao", password: "password1" }, (() => json({ error: { code: "username_taken" } }, 409)) as unknown as typeof fetch)).toEqual({ ok: false, error: "That username is taken." });
    expect(await api.login({ username: "hao", password: "x" }, (() => json({ error: {} }, 401)) as unknown as typeof fetch)).toEqual({ ok: false, error: "Wrong username or password." });
    const off = await api.login({ username: "hao", password: "x" }, (() => Promise.reject(new TypeError("offline"))) as unknown as typeof fetch);
    expect(off.ok).toBe(false);
  });

  it("logout() is true on success, false offline", async () => {
    expect(await api.logout((() => json({ ok: true })) as unknown as typeof fetch)).toBe(true);
    expect(await api.logout((() => Promise.reject(new TypeError("offline"))) as unknown as typeof fetch)).toBe(false);
  });

  it("setAvatar() PUTs the avatar and returns the user", async () => {
    const f = vi.fn((_u: string, _i?: RequestInit) => json({ user }));
    expect(await api.setAvatar({ model: "kai", hue: 10 }, f as unknown as typeof fetch)).toEqual(user);
    expect(calls(f)[0]![1].method).toBe("PUT");
  });

  it("myAttempts() returns the list, or null on 401", async () => {
    const list = [{ questionId: "q-one", score: 70, day: "2026-11-21" }];
    expect(await api.myAttempts((() => json({ attempts: list })) as unknown as typeof fetch)).toEqual(list);
    expect(await api.myAttempts((() => json({ error: {} }, 401)) as unknown as typeof fetch)).toBeNull();
  });
});
