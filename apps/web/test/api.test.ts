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
