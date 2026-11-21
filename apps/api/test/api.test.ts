import { env } from "cloudflare:test";
import { dailyQuestion, QUESTIONS } from "@tower/shared";
import { describe, expect, it } from "vitest";
import { ANON_A, ANON_B, client, clock } from "./helpers";

describe("GET /api/health", () => {
  it("reports ok with a working database", async () => {
    const res = await client().get("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "ok", environment: "test" });
  });

  it("answers unknown API routes with a JSON 404", async () => {
    const res = await client().get("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "not_found", message: "No such endpoint." } });
  });

  it("tags every response with a request id, nosniff and no-store", async () => {
    const res = await client().get("/api/health");
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("write guards", () => {
  it("refuses a cross-site post", async () => {
    const res = await client().post("/api/presence", { anonId: ANON_A, room: null }, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });

  it("refuses a form post, which a cross-site page could send without a preflight", async () => {
    const res = await client().call("/api/presence", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "anonId=x" });
    expect(res.status).toBe(415);
  });

  it("accepts a same-site post", async () => {
    const res = await client().post("/api/presence", { anonId: ANON_A, room: null }, { origin: "http://localhost:8788" });
    expect(res.status).toBe(200);
  });

  it("rejects malformed bodies with a 400 that names the problem", async () => {
    const res = await client().post("/api/presence", { anonId: "short", room: "no-such-room" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_body");
  });

  it("rejects a body that is not JSON", async () => {
    const res = await client().call("/api/presence", { method: "POST", headers: { "content-type": "application/json" }, body: "{nope" });
    expect(res.status).toBe(400);
  });
});

describe("presence", () => {
  it("counts a visitor who just checked in and shows them in their room", async () => {
    const c = client();
    const res = await c.post("/api/presence", { anonId: ANON_A, room: "agents", avatar: "fox" });
    const body = (await res.json()) as { online: number; rooms: Record<string, number>; visitors: { avatar: string; room: string | null }[] };
    expect(body.online).toBe(1);
    expect(body.rooms.agents).toBe(1);
    expect(body.visitors).toEqual([{ avatar: "fox", room: "agents" }]);
  });

  it("never exposes anyone's id", async () => {
    const c = client();
    await c.post("/api/presence", { anonId: ANON_A, room: null, avatar: "owl" });
    const text = await (await c.get("/api/presence")).text();
    expect(text).not.toContain(ANON_A);
  });

  it("is one row per visitor: the same id moving room does not double count", async () => {
    const c = client();
    await c.post("/api/presence", { anonId: ANON_A, room: "agents", avatar: "owl" });
    await c.post("/api/presence", { anonId: ANON_A, room: "llm-inference", avatar: "owl" });
    await c.post("/api/presence", { anonId: ANON_B, room: "llm-inference", avatar: "cat" });
    const body = (await (await c.get("/api/presence")).json()) as { online: number; rooms: Record<string, number> };
    expect(body.online).toBe(2);
    expect(body.rooms["llm-inference"]).toBe(2);
    expect(body.rooms.agents ?? 0).toBe(0);
  });

  it("forgets a visitor who has stopped sending heartbeats", async () => {
    const t = clock();
    const c = client({ now: t.now });
    await c.post("/api/presence", { anonId: ANON_A, room: null, avatar: "owl" });
    t.advance(45_000);
    expect(((await (await c.get("/api/presence")).json()) as { online: number }).online).toBe(1);
    t.advance(30_000);
    expect(((await (await c.get("/api/presence")).json()) as { online: number }).online).toBe(0);
  });

  it("prunes long-gone rows when someone checks in", async () => {
    const t = clock();
    const c = client({ now: t.now });
    await c.post("/api/presence", { anonId: ANON_A, room: null, avatar: "owl" });
    t.advance(10 * 60_000);
    await c.post("/api/presence", { anonId: ANON_B, room: null, avatar: "cat" });
    const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM presence").first<{ n: number }>();
    expect(rows?.n).toBe(1);
  });

  it("lists at most 12 visitors but counts everyone", async () => {
    const c = client();
    for (let i = 0; i < 15; i++) await c.post("/api/presence", { anonId: `visitor${String(i).padStart(2, "0")}-aaaaaaaa`, room: null, avatar: "owl" });
    const body = (await (await c.get("/api/presence")).json()) as { online: number; visitors: unknown[] };
    expect(body.online).toBe(15);
    expect(body.visitors).toHaveLength(12);
  });
});

describe("attempts and stats", () => {
  const q = QUESTIONS[0]!;

  it("records an attempt and returns the question's running stats", async () => {
    const c = client();
    const res = await c.post("/api/attempts", { anonId: ANON_A, questionId: q.id, score: 80, seconds: 95 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ attempts: 1, avgScore: 80, beat: 0 });
  });

  it("says what share of earlier attempts the score beat", async () => {
    const c = client();
    await c.post("/api/attempts", { anonId: ANON_A, questionId: q.id, score: 40, seconds: 60 });
    const res = await c.post("/api/attempts", { anonId: ANON_B, questionId: q.id, score: 90, seconds: 60 });
    expect(await res.json()).toEqual({ attempts: 2, avgScore: 65, beat: 100 });
  });

  it("keeps one attempt per visitor per question per day, so stats cannot be stuffed", async () => {
    const c = client();
    await c.post("/api/attempts", { anonId: ANON_A, questionId: q.id, score: 10, seconds: 60 });
    const res = await c.post("/api/attempts", { anonId: ANON_A, questionId: q.id, score: 70, seconds: 60 });
    expect(await res.json()).toMatchObject({ attempts: 1, avgScore: 70 });
  });

  it("counts a new day as a new attempt", async () => {
    const t = clock();
    const c = client({ now: t.now });
    await c.post("/api/attempts", { anonId: ANON_A, questionId: q.id, score: 10, seconds: 60 });
    t.advance(86_400_000);
    const res = await c.post("/api/attempts", { anonId: ANON_A, questionId: q.id, score: 50, seconds: 60 });
    expect(await res.json()).toMatchObject({ attempts: 2, avgScore: 30 });
  });

  it("refuses an unknown question and an impossible score", async () => {
    const c = client();
    expect((await c.post("/api/attempts", { anonId: ANON_A, questionId: "no-such-question", score: 50, seconds: 5 })).status).toBe(404);
    expect((await c.post("/api/attempts", { anonId: ANON_A, questionId: q.id, score: 101, seconds: 5 })).status).toBe(400);
    expect((await c.post("/api/attempts", { anonId: ANON_A, questionId: q.id, score: -1, seconds: 5 })).status).toBe(400);
  });

  it("serves stats for a question, zero when nobody has tried it", async () => {
    const c = client();
    expect(await (await c.get(`/api/stats/${q.id}`)).json()).toEqual({ attempts: 0, avgScore: null });
    await c.post("/api/attempts", { anonId: ANON_A, questionId: q.id, score: 61, seconds: 5 });
    expect(await (await c.get(`/api/stats/${q.id}`)).json()).toEqual({ attempts: 1, avgScore: 61 });
    expect((await c.get("/api/stats/no-such-question")).status).toBe(404);
  });
});

describe("GET /api/daily", () => {
  it("names today's question the same way the shared library does, with today's attempts", async () => {
    const t = clock("2026-11-21T10:00:00Z");
    const c = client({ now: t.now });
    const expected = dailyQuestion(QUESTIONS, "2026-11-21");
    await c.post("/api/attempts", { anonId: ANON_A, questionId: expected.id, score: 70, seconds: 30 });
    expect(await (await c.get("/api/daily")).json()).toEqual({ day: "2026-11-21", questionId: expected.id, attemptsToday: 1 });
  });

  it("rolls over at UTC midnight", async () => {
    const t = clock("2026-11-21T23:59:00Z");
    const c = client({ now: t.now });
    const before = ((await (await c.get("/api/daily")).json()) as { day: string }).day;
    t.advance(2 * 60_000);
    const after = ((await (await c.get("/api/daily")).json()) as { day: string }).day;
    expect([before, after]).toEqual(["2026-11-21", "2026-11-22"]);
  });
});
