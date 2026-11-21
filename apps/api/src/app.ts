import { AttemptInputSchema, PresenceInputSchema, QUESTIONS, ROOM_IDS, dailyQuestion, dayKey, questionById } from "@tower/shared";
import { Hono } from "hono";
import { identityOf, registerAuthRoutes, sessionUser, type AppEnv } from "./auth";
import { defaultDeps, type Deps } from "./deps";
import { err, parseBody } from "./http";

/** A visitor who has not checked in for this long is gone. The page beats every 20s. */
export const PRESENCE_WINDOW_MS = 60_000;
/** Rows older than this are deleted whenever someone checks in. */
const PRESENCE_PRUNE_MS = 5 * 60_000;
const VISITORS_SHOWN = 12;

export function createApp(overrides: Partial<Deps> = {}) {
  const deps: Deps = { ...defaultDeps, ...overrides };
  const app = new Hono<AppEnv>().basePath("/api");

  app.use("*", async (c, next) => {
    const id = deps.requestId();
    c.set("deps", deps);
    await next();
    c.res.headers.set("x-request-id", id);
    c.res.headers.set("x-content-type-options", "nosniff");
    c.res.headers.set("cache-control", "no-store");
  });

  // Writes (POST, PUT) are JSON only, from our own origin. A cross-site form cannot send application/json without a preflight.
  app.use("*", async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD" && c.req.method !== "OPTIONS") {
      const origin = c.req.header("origin");
      if (origin) {
        const ours = new Set([new URL(c.req.url).origin, new URL(c.env.SITE_URL).origin]);
        if (!ours.has(origin)) return c.json(err("forbidden_origin", "Cross-site requests are not allowed."), 403);
      }
      if (!(c.req.header("content-type") ?? "").toLowerCase().startsWith("application/json")) {
        return c.json(err("unsupported_media_type", "Send application/json."), 415);
      }
    }
    await next();
  });

  app.get("/health", async (c) => {
    const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return c.json({ ok: true, db: row?.ok === 1 ? "ok" : "down", environment: c.env.ENVIRONMENT });
  });

  async function readPresence(db: D1Database, now: number) {
    const since = now - PRESENCE_WINDOW_MS;
    const [rooms, rows] = await db.batch<{ room: string | null; n: number } & { avatar: string }>([
      db.prepare("SELECT room, COUNT(*) AS n FROM presence WHERE seen_at > ? GROUP BY room").bind(since),
      db.prepare("SELECT avatar, room FROM presence WHERE seen_at > ? ORDER BY seen_at DESC LIMIT ?").bind(since, VISITORS_SHOWN),
    ]);
    const perRoom: Record<string, number> = Object.fromEntries(ROOM_IDS.map((id) => [id, 0]));
    let online = 0;
    for (const r of rooms!.results) {
      online += r.n;
      if (r.room && r.room in perRoom) perRoom[r.room] = r.n;
    }
    const visitors = rows!.results.map((r) => ({ avatar: r.avatar, room: r.room }));
    return { online, rooms: perRoom, visitors };
  }

  /** The signed-in account's identity when a valid session cookie is present, otherwise the anonymous id the client sent. */
  async function identity(c: Parameters<typeof sessionUser>[0], anonId: string): Promise<string> {
    const user = await sessionUser(c);
    return user ? identityOf(user.id) : anonId;
  }

  registerAuthRoutes(app);

  app.get("/presence", async (c) => c.json(await readPresence(c.env.DB, deps.now())));

  app.post("/presence", async (c) => {
    const parsed = await parseBody(c.req.raw, PresenceInputSchema);
    if (!parsed.ok) return c.json(parsed.body, 400);
    const { room, avatar } = parsed.data;
    const anonId = await identity(c, parsed.data.anonId);
    const now = deps.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO presence (anon_id, room, avatar, seen_at) VALUES (?, ?, ?, ?) ON CONFLICT (anon_id) DO UPDATE SET room = excluded.room, avatar = excluded.avatar, seen_at = excluded.seen_at",
      ).bind(anonId, room, avatar, now),
      c.env.DB.prepare("DELETE FROM presence WHERE seen_at < ?").bind(now - PRESENCE_PRUNE_MS),
    ]);
    return c.json(await readPresence(c.env.DB, now));
  });

  async function statsFor(db: D1Database, questionId: string) {
    const row = await db.prepare("SELECT COUNT(*) AS n, AVG(score) AS avg FROM attempts WHERE question_id = ?").bind(questionId).first<{ n: number; avg: number | null }>();
    return { attempts: row?.n ?? 0, avgScore: row?.avg == null ? null : Math.round(row.avg) };
  }

  app.get("/stats/:id", async (c) => {
    const id = c.req.param("id");
    if (!questionById(id)) return c.json(err("not_found", "No such question."), 404);
    const user = await sessionUser(c);
    const anon = c.req.query("anonId");
    const who = user ? identityOf(user.id) : anon && /^[a-z0-9-]{8,64}$/.test(anon) ? anon : null;
    const mine = who
      ? await c.env.DB.prepare("SELECT score, day FROM attempts WHERE anon_id = ? AND question_id = ? ORDER BY day DESC LIMIT 1").bind(who, id).first<{ score: number; day: string }>()
      : null;
    return c.json({ ...(await statsFor(c.env.DB, id)), ...(who ? { mine: mine ?? null } : {}) });
  });

  app.post("/attempts", async (c) => {
    const parsed = await parseBody(c.req.raw, AttemptInputSchema);
    if (!parsed.ok) return c.json(parsed.body, 400);
    const { questionId, score, seconds } = parsed.data;
    const anonId = await identity(c, parsed.data.anonId);
    if (!questionById(questionId)) return c.json(err("not_found", "No such question."), 404);
    const now = deps.now();
    const day = dayKey(new Date(now));
    await c.env.DB.prepare(
      "INSERT INTO attempts (anon_id, question_id, day, score, seconds, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (anon_id, question_id, day) DO UPDATE SET score = excluded.score, seconds = excluded.seconds, created_at = excluded.created_at",
    )
      .bind(anonId, questionId, day, score, seconds, now)
      .run();
    // "Beat" is measured against other people's latest attempts only, never your own.
    const others = await c.env.DB.prepare(
      "SELECT COUNT(*) AS n, SUM(CASE WHEN score < ? THEN 1 ELSE 0 END) AS below FROM attempts WHERE question_id = ? AND NOT (anon_id = ? AND day = ?)",
    )
      .bind(score, questionId, anonId, day)
      .first<{ n: number; below: number | null }>();
    const beat = others && others.n > 0 ? Math.round((100 * (others.below ?? 0)) / others.n) : 0;
    return c.json({ ...(await statsFor(c.env.DB, questionId)), beat });
  });

  app.get("/daily", async (c) => {
    const day = dayKey(new Date(deps.now()));
    const q = dailyQuestion(QUESTIONS, day);
    const row = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM attempts WHERE question_id = ? AND day = ?").bind(q.id, day).first<{ n: number }>();
    return c.json({ day, questionId: q.id, attemptsToday: row?.n ?? 0 });
  });

  app.notFound((c) => c.json(err("not_found", "No such endpoint."), 404));
  app.onError((e, c) => {
    console.error(JSON.stringify({ level: "error", msg: e.message, path: c.req.path }));
    return c.json(err("internal", "Something went wrong."), 500);
  });

  return app;
}
