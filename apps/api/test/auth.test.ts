import { env } from "cloudflare:test";
import { dayKey } from "@tower/shared";
import { describe, expect, it } from "vitest";
import { ANON_A, ANON_B, client, clock } from "./helpers";

const CREDS = { username: "Hao_Tower", password: "correct horse battery" };
const Q = "prompt-cache-prefix";

function cookieOf(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  const m = /tower_session=([^;]*)/.exec(raw);
  return m ? `tower_session=${m[1]}` : "";
}

async function registered(c = client(), body: Record<string, unknown> = CREDS) {
  const res = await c.post("/api/auth/register", body);
  return { res, cookie: cookieOf(res) };
}
const withCookie = (cookie: string) => ({ cookie });
const getAs = (c: ReturnType<typeof client>, path: string, cookie: string) => c.call(path, { headers: { cookie } });

describe("register", () => {
  it("creates an account, signs in and returns only the public user", async () => {
    const { res, cookie } = await registered();
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: Record<string, unknown> };
    expect(Object.keys(body.user).sort()).toEqual(["avatar", "id", "username"]);
    expect(body.user.username).toBe("Hao_Tower");
    expect(body.user.avatar).toEqual({ model: "sakura" });
    expect(cookie).toMatch(/^tower_session=[A-Za-z0-9_-]{40,}$/);
  });

  it("sets a hardened cookie: HttpOnly, SameSite=Lax, Path=/, 30 days, no Secure on plain-http localhost", async () => {
    const { res } = await registered();
    const raw = res.headers.get("set-cookie")!;
    expect(raw).toContain("HttpOnly");
    expect(raw).toMatch(/SameSite=Lax/i);
    expect(raw).toContain("Path=/");
    expect(raw).toMatch(/Max-Age=2592000/);
    expect(raw).not.toMatch(/Secure/i);
  });

  it("marks the cookie Secure over https", async () => {
    const res = await client().post("https://tower.example/api/auth/register", CREDS);
    expect(res.headers.get("set-cookie")).toMatch(/Secure/i);
  });

  it("stores the chosen avatar", async () => {
    const { res } = await registered(client(), { ...CREDS, avatar: { model: "kai", hue: 120 } });
    expect(((await res.json()) as { user: { avatar: unknown } }).user.avatar).toEqual({ model: "kai", hue: 120 });
  });

  it("refuses a duplicate username, ignoring case, with 409", async () => {
    const c = client();
    await registered(c);
    const again = await c.post("/api/auth/register", { ...CREDS, username: "hao_tower" });
    expect(again.status).toBe(409);
    expect(((await again.json()) as { error: { code: string } }).error.code).toBe("username_taken");
  });

  it.each([
    ["short username", { username: "ab", password: "longenough1" }],
    ["bad characters", { username: "no spaces", password: "longenough1" }],
    ["short password", { username: "fine_name", password: "short" }],
    ["long password", { username: "fine_name", password: "x".repeat(73) }],
    ["bad avatar", { username: "fine_name", password: "longenough1", avatar: { model: "owl" } }],
  ])("rejects %s with 400", async (_n, body) => {
    const res = await client().post("/api/auth/register", body);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("invalid_body");
  });

  it("never stores the password, or the raw token", async () => {
    const { cookie } = await registered();
    const u = await env.DB.prepare("SELECT * FROM users").first<Record<string, string>>();
    const dump = JSON.stringify(u);
    expect(dump).not.toContain(CREDS.password);
    expect(u!.password_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(u!.salt).toMatch(/^[0-9a-f]{32}$/);
    const token = cookie.split("=")[1]!;
    const s = await env.DB.prepare("SELECT * FROM sessions").first<Record<string, string>>();
    expect(JSON.stringify(s)).not.toContain(token);
    expect(s!.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives two users with the same password different hashes (per-user salt)", async () => {
    const c = client();
    await registered(c, { username: "user_one", password: "same password!" });
    await registered(c, { username: "user_two", password: "same password!" });
    const { results } = await env.DB.prepare("SELECT password_hash FROM users").all<{ password_hash: string }>();
    expect(new Set(results.map((r) => r.password_hash)).size).toBe(2);
  });

  it("rejects a cross-origin post", async () => {
    const res = await client().post("/api/auth/register", CREDS, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>())!.n).toBe(0);
  });
});

describe("login", () => {
  it("signs in with the right password, any username casing", async () => {
    const c = client();
    await registered(c);
    const res = await c.post("/api/auth/login", { username: "HAO_TOWER", password: CREDS.password });
    expect(res.status).toBe(200);
    expect(cookieOf(res)).not.toBe("");
    expect(((await res.json()) as { user: { username: string } }).user.username).toBe("Hao_Tower");
  });

  it("gives the same generic 401 for a wrong password and an unknown user", async () => {
    const c = client();
    await registered(c);
    const wrong = await c.post("/api/auth/login", { username: CREDS.username, password: "nope nope nope" });
    const ghost = await c.post("/api/auth/login", { username: "nobody_here", password: "nope nope nope" });
    expect(wrong.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(await wrong.json()).toEqual(await ghost.json());
    expect(wrong.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a malformed body with 400", async () => {
    expect((await client().post("/api/auth/login", { username: "x" })).status).toBe(400);
  });
});

describe("me and logout", () => {
  it("is null without a cookie and the user with one", async () => {
    const c = client();
    expect(await (await c.get("/api/auth/me")).json()).toEqual({ user: null });
    const { cookie } = await registered(c);
    const me = (await (await getAs(c, "/api/auth/me", cookie)).json()) as { user: { username: string } };
    expect(me.user.username).toBe("Hao_Tower");
  });

  it("treats a garbage cookie as signed out", async () => {
    expect(await (await getAs(client(), "/api/auth/me", "tower_session=garbage")).json()).toEqual({ user: null });
  });

  it("logout deletes the session, so the old cookie stops working, and clears the cookie", async () => {
    const c = client();
    const { cookie } = await registered(c);
    const out = await c.post("/api/auth/logout", {}, withCookie(cookie));
    expect(out.status).toBe(200);
    expect(out.headers.get("set-cookie")).toMatch(/tower_session=;|Max-Age=0/);
    expect(await (await getAs(c, "/api/auth/me", cookie)).json()).toEqual({ user: null });
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions").first<{ n: number }>())!.n).toBe(0);
  });

  it("logout without a session is still fine", async () => {
    expect((await client().post("/api/auth/logout", {})).status).toBe(200);
  });

  it("rejects an expired session after 30 days", async () => {
    const t = clock();
    const c = client({ now: t.now });
    const { cookie } = await registered(c);
    t.advance(29 * 86_400_000);
    expect(((await (await getAs(c, "/api/auth/me", cookie)).json()) as { user: unknown }).user).not.toBeNull();
    t.advance(2 * 86_400_000);
    expect(await (await getAs(c, "/api/auth/me", cookie)).json()).toEqual({ user: null });
  });
});

describe("avatar", () => {
  it("updates the avatar for the signed-in user", async () => {
    const c = client();
    const { cookie } = await registered(c);
    const res = await c.call("/api/auth/avatar", { method: "PUT", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ avatar: { model: "hana", hue: 300 } }) });
    expect(res.status).toBe(200);
    const me = (await (await getAs(c, "/api/auth/me", cookie)).json()) as { user: { avatar: unknown } };
    expect(me.user.avatar).toEqual({ model: "hana", hue: 300 });
  });

  it("validates the avatar and requires a session", async () => {
    const c = client();
    const { cookie } = await registered(c);
    const put = (body: unknown, ck: string) => c.call("/api/auth/avatar", { method: "PUT", headers: { "content-type": "application/json", ...(ck ? { cookie: ck } : {}) }, body: JSON.stringify(body) });
    expect((await put({ avatar: { model: "owl" } }, cookie)).status).toBe(400);
    expect((await put({ avatar: { model: "ren", hue: 999 } }, cookie)).status).toBe(400);
    expect((await put({ avatar: { model: "ren" } }, "")).status).toBe(401);
  });

  it("refuses a cross-origin avatar change", async () => {
    const c = client();
    const { cookie } = await registered(c);
    const res = await c.call("/api/auth/avatar", { method: "PUT", headers: { "content-type": "application/json", cookie, origin: "https://evil.example" }, body: JSON.stringify({ avatar: { model: "ren" } }) });
    expect(res.status).toBe(403);
  });
});

describe("attempts under an account", () => {
  const day = dayKey(new Date("2026-11-21T10:00:00Z"));
  const attempt = (c: ReturnType<typeof client>, anonId: string, score: number, cookie?: string, questionId = Q) =>
    c.post("/api/attempts", { anonId, questionId, score, seconds: 30 }, cookie ? withCookie(cookie) : {});

  it("attributes attempts to the user when a session is present, whatever anonId is sent", async () => {
    const c = client({ now: clock().now });
    const { cookie, res } = await registered(c);
    const uid = ((await res.json()) as { user: { id: string } }).user.id;
    await attempt(c, ANON_A, 70, cookie);
    const rows = await env.DB.prepare("SELECT anon_id FROM attempts").all<{ anon_id: string }>();
    expect(rows.results.map((r) => r.anon_id)).toEqual([`u:${uid}`]);
  });

  it("lists my attempts, only mine, and needs a session", async () => {
    const c = client({ now: clock().now });
    const { cookie } = await registered(c);
    await attempt(c, ANON_A, 70, cookie);
    await attempt(c, ANON_B, 40);
    expect((await c.get("/api/me/attempts")).status).toBe(401);
    const list = (await (await getAs(c, "/api/me/attempts", cookie)).json()) as { attempts: unknown[] };
    expect(list.attempts).toEqual([{ questionId: Q, score: 70, day }]);
  });

  it("never returns the raw identity", async () => {
    const c = client({ now: clock().now });
    const { cookie, res } = await registered(c);
    const uid = ((await res.json()) as { user: { id: string } }).user.id;
    for (const path of ["/api/me/attempts", "/api/auth/me"]) expect(await (await getAs(c, path, cookie)).text()).not.toContain(`u:${uid}`);
    const pres = await c.post("/api/presence", { anonId: ANON_A, room: "agents", avatar: "owl" }, withCookie(cookie));
    expect(await pres.text()).not.toContain(uid);
  });

  it("merges the anonymous visitor's attempts on register, without double counting", async () => {
    const c = client({ now: clock().now });
    await attempt(c, ANON_A, 55);
    await attempt(c, ANON_A, 80, undefined, "tool-failure-loop");
    const { cookie } = await registered(c, { ...CREDS, anonId: ANON_A });
    const list = (await (await getAs(c, "/api/me/attempts", cookie)).json()) as { attempts: { questionId: string; score: number }[] };
    expect(list.attempts.map((a) => `${a.questionId}:${a.score}`).sort()).toEqual([`tool-failure-loop:80`, `${Q}:55`].sort());
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM attempts").first<{ n: number }>())!.n).toBe(2);
  });

  it("merges on login too, and keeps the account's own row when both exist for the same day", async () => {
    const t = clock();
    const c = client({ now: t.now });
    const { cookie } = await registered(c);
    await attempt(c, ANON_A, 90, cookie); // account row: 90
    const anon = client({ now: t.now });
    await attempt(anon, ANON_B, 20); // anonymous row for the same question and day
    await attempt(anon, ANON_B, 33, undefined, "tool-failure-loop");
    const login = await c.post("/api/auth/login", { username: CREDS.username, password: CREDS.password, anonId: ANON_B });
    const ck = cookieOf(login);
    const list = (await (await getAs(c, "/api/me/attempts", ck)).json()) as { attempts: { questionId: string; score: number }[] };
    const byQ = Object.fromEntries(list.attempts.map((a) => [a.questionId, a.score]));
    expect(byQ[Q]).toBe(90);
    expect(byQ["tool-failure-loop"]).toBe(33);
  });

  it("stats still work for a signed-in user and report their own score", async () => {
    const c = client({ now: clock().now });
    const { cookie } = await registered(c);
    await attempt(c, ANON_A, 64, cookie);
    const stats = (await (await getAs(c, `/api/stats/${Q}`, cookie)).json()) as { attempts: number; avgScore: number; mine: { score: number } | null };
    expect(stats.attempts).toBe(1);
    expect(stats.avgScore).toBe(64);
    expect(stats.mine?.score).toBe(64);
    const anonStats = (await (await c.get(`/api/stats/${Q}`)).json()) as { mine: unknown };
    expect(anonStats.mine).toBeUndefined();
  });

  it("presence uses the account identity: one row, and the anonymous row is removed on merge", async () => {
    const c = client();
    await c.post("/api/presence", { anonId: ANON_A, room: "agents", avatar: "owl" });
    const { cookie } = await registered(c, { ...CREDS, anonId: ANON_A });
    const res = await c.post("/api/presence", { anonId: ANON_A, room: "agents", avatar: "owl" }, withCookie(cookie));
    expect(((await res.json()) as { online: number }).online).toBe(1);
  });
});
