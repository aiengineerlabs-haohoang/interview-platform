import { AvatarSchema, AvatarUpdateSchema, DEFAULT_USER_AVATAR, LoginInputSchema, RegisterInputSchema, type PublicUser, type UserAvatar } from "@tower/shared";
import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Deps } from "./deps";
import type { Env } from "./env";
import { err, parseBody } from "./http";

export const SESSION_COOKIE = "tower_session";
export const SESSION_TTL_MS = 30 * 86_400_000;
/** The most iterations the Workers runtime allows for PBKDF2. */
export const PBKDF2_ITERATIONS = 100_000;

const enc = new TextEncoder();

export const toHex = (buf: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS }, key, 256);
  return toHex(bits);
}

/** Compares every byte whatever the first difference is. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

export const newSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)));
export const newToken = () => toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

/** An unknown username still costs one PBKDF2, so response time does not reveal which usernames exist. */
const DUMMY_SALT = "00000000000000000000000000000000";

export function parseAvatar(json: string): UserAvatar {
  try {
    const r = AvatarSchema.safeParse(JSON.parse(json));
    if (r.success) return r.data;
  } catch {
    /* fall through */
  }
  return DEFAULT_USER_AVATAR;
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  avatar: string;
}

export const publicUser = (u: Pick<UserRow, "id" | "username" | "avatar">): PublicUser => ({ id: u.id, username: u.username, avatar: parseAvatar(u.avatar) });

/** `u:` can never appear in an anonymous id, so the two kinds of visitor share tables without colliding. */
export const identityOf = (userId: string) => `u:${userId}`;

export type AppEnv = { Bindings: Env; Variables: { deps: Deps } };
type AuthCtx = Context<AppEnv>;

export async function sessionUser(c: AuthCtx): Promise<PublicUser | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token || token.length > 128) return null;
  const row = await c.env.DB.prepare(
    "SELECT u.id, u.username, u.avatar FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
  )
    .bind(await sha256Hex(token), c.get("deps").now())
    .first<Pick<UserRow, "id" | "username" | "avatar">>();
  return row ? publicUser(row) : null;
}

function isLocalHttp(url: URL) {
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

async function startSession(c: AuthCtx, userId: string) {
  const now = c.get("deps").now();
  const token = newToken();
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    c.env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(await sha256Hex(token), userId, now + SESSION_TTL_MS, now),
  ]);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !isLocalHttp(new URL(c.req.url)),
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** Move an anonymous visitor's attempts to the account. The account's own row wins if both exist for a day. */
async function mergeAnon(db: D1Database, anonId: string | undefined, userId: string) {
  if (!anonId) return;
  const ident = identityOf(userId);
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO attempts (anon_id, question_id, day, score, seconds, created_at) SELECT ?, question_id, day, score, seconds, created_at FROM attempts WHERE anon_id = ?").bind(ident, anonId),
    db.prepare("DELETE FROM attempts WHERE anon_id = ?").bind(anonId),
    db.prepare("DELETE FROM presence WHERE anon_id = ?").bind(anonId),
  ]);
}

export function registerAuthRoutes(app: Hono<AppEnv, {}, string>) {
  app.post("/auth/register", async (c: AuthCtx) => {
    const parsed = await parseBody(c.req.raw, RegisterInputSchema);
    if (!parsed.ok) return c.json(parsed.body, 400);
    const { username, password, anonId, avatar } = parsed.data as ReturnType<typeof RegisterInputSchema.parse>;
    const taken = () => c.json(err("username_taken", "That username is taken."), 409);
    if (await c.env.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(username).first()) return taken();
    const salt = newSalt();
    const row = { id: crypto.randomUUID(), username, password_hash: await hashPassword(password, salt), salt, avatar: JSON.stringify(avatar ?? DEFAULT_USER_AVATAR) };
    try {
      await c.env.DB.prepare("INSERT INTO users (id, username, password_hash, salt, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(row.id, row.username, row.password_hash, row.salt, row.avatar, c.get("deps").now())
        .run();
    } catch (e) {
      if (/UNIQUE/i.test(String(e instanceof Error ? e.message : e))) return taken();
      throw e;
    }
    await mergeAnon(c.env.DB, anonId, row.id);
    await startSession(c, row.id);
    return c.json({ user: publicUser(row) }, 201);
  });

  app.post("/auth/login", async (c: AuthCtx) => {
    const parsed = await parseBody(c.req.raw, LoginInputSchema);
    if (!parsed.ok) return c.json(parsed.body, 400);
    const { username, password, anonId } = parsed.data as ReturnType<typeof LoginInputSchema.parse>;
    const row = await c.env.DB.prepare("SELECT id, username, password_hash, salt, avatar FROM users WHERE username = ?").bind(username).first<UserRow>();
    const candidate = await hashPassword(password, row?.salt ?? DUMMY_SALT);
    if (!row || !safeEqual(candidate, row.password_hash)) return c.json(err("bad_credentials", "Wrong username or password."), 401);
    await mergeAnon(c.env.DB, anonId, row.id);
    await startSession(c, row.id);
    return c.json({ user: publicUser(row) });
  });

  app.post("/auth/logout", async (c: AuthCtx) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token && token.length <= 128) await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
    deleteCookie(c, SESSION_COOKIE, { path: "/", httpOnly: true, secure: !isLocalHttp(new URL(c.req.url)), sameSite: "Lax" });
    return c.json({ ok: true });
  });

  app.get("/auth/me", async (c: AuthCtx) => c.json({ user: await sessionUser(c) }));

  app.put("/auth/avatar", async (c: AuthCtx) => {
    const user = await sessionUser(c);
    if (!user) return c.json(err("unauthorized", "Sign in first."), 401);
    const parsed = await parseBody(c.req.raw, AvatarUpdateSchema);
    if (!parsed.ok) return c.json(parsed.body, 400);
    const { avatar } = parsed.data as ReturnType<typeof AvatarUpdateSchema.parse>;
    await c.env.DB.prepare("UPDATE users SET avatar = ? WHERE id = ?").bind(JSON.stringify(avatar), user.id).run();
    return c.json({ user: { ...user, avatar } });
  });

  app.get("/me/attempts", async (c: AuthCtx) => {
    const user = await sessionUser(c);
    if (!user) return c.json(err("unauthorized", "Sign in first."), 401);
    const { results } = await c.env.DB.prepare("SELECT question_id, score, day FROM attempts WHERE anon_id = ? ORDER BY day DESC, question_id LIMIT 2000")
      .bind(identityOf(user.id))
      .all<{ question_id: string; score: number; day: string }>();
    return c.json({ attempts: results.map((r) => ({ questionId: r.question_id, score: r.score, day: r.day })) });
  });
}
