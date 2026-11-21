import { MeSchema, MyAttemptSchema, PublicUserSchema, type AttemptInput, type LoginInput, type MyAttempt, type PresenceInput, type PublicUser, type RegisterInput, type UserAvatar } from "@tower/shared";
import { z } from "zod";

const PresenceSchema = z.object({
  online: z.number().int().min(0),
  rooms: z.record(z.string(), z.number().int().min(0)),
  visitors: z.array(z.object({ avatar: z.string(), room: z.string().nullable() })),
});
export type PresenceState = z.infer<typeof PresenceSchema>;

const AttemptResultSchema = z.object({ attempts: z.number().int(), avgScore: z.number().nullable(), beat: z.number().int() });
export type AttemptResult = z.infer<typeof AttemptResultSchema>;

const DailySchema = z.object({ day: z.string(), questionId: z.string(), attemptsToday: z.number().int() });
export type Daily = z.infer<typeof DailySchema>;

type Method = "GET" | "POST" | "PUT";

async function send(path: string, method: Method, body: unknown, fetcher: typeof fetch): Promise<{ status: number; json: unknown }> {
  const res = await fetcher(path, {
    method,
    credentials: "same-origin",
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* an empty or non-JSON body */
  }
  return { status: res.status, json };
}

/** The product works without the network: every call resolves to null instead of throwing. */
async function call<T>(path: string, schema: z.ZodType<T>, body?: unknown, fetcher: typeof fetch = fetch, method: Method = body === undefined ? "GET" : "POST"): Promise<T | null> {
  try {
    const { status, json } = await send(path, method, body, fetcher);
    if (status < 200 || status >= 300) return null;
    const parsed = schema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Register and login must say why they failed (taken name, wrong password, offline), so they return a result. */
export type AuthResult = { ok: true; user: PublicUser } | { ok: false; error: string };

const OFFLINE = "Could not reach the server. You can keep playing as a guest.";

async function authCall(path: string, body: LoginInput | RegisterInput, fetcher: typeof fetch = fetch): Promise<AuthResult> {
  try {
    const { status, json } = await send(path, "POST", body, fetcher);
    const ok = MeSchema.safeParse(json);
    if (status >= 200 && status < 300 && ok.success && ok.data.user) return { ok: true, user: ok.data.user };
    const message = (json as { error?: { message?: unknown } } | null)?.error?.message;
    if (status === 409) return { ok: false, error: "That username is taken." };
    if (status === 401) return { ok: false, error: "Wrong username or password." };
    return { ok: false, error: typeof message === "string" && status < 500 ? message : "Something went wrong. Try again." };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

const MyAttemptsSchema = z.object({ attempts: z.array(MyAttemptSchema) });

export const api = {
  presence: (fetcher?: typeof fetch) => call("/api/presence", PresenceSchema, undefined, fetcher),
  heartbeat: (input: PresenceInput, fetcher?: typeof fetch) => call("/api/presence", PresenceSchema, input, fetcher),
  attempt: (input: AttemptInput, fetcher?: typeof fetch) => call("/api/attempts", AttemptResultSchema, input, fetcher),
  daily: (fetcher?: typeof fetch) => call("/api/daily", DailySchema, undefined, fetcher),
  me: (fetcher?: typeof fetch) => call("/api/auth/me", MeSchema, undefined, fetcher),
  register: (input: RegisterInput, fetcher?: typeof fetch) => authCall("/api/auth/register", input, fetcher),
  login: (input: LoginInput, fetcher?: typeof fetch) => authCall("/api/auth/login", input, fetcher),
  logout: async (fetcher?: typeof fetch) => (await call("/api/auth/logout", z.object({ ok: z.literal(true) }), {}, fetcher)) !== null,
  setAvatar: async (avatar: UserAvatar, fetcher?: typeof fetch) => (await call("/api/auth/avatar", z.object({ user: PublicUserSchema }), { avatar }, fetcher, "PUT"))?.user ?? null,
  myAttempts: async (fetcher?: typeof fetch): Promise<MyAttempt[] | null> => (await call("/api/me/attempts", MyAttemptsSchema, undefined, fetcher))?.attempts ?? null,
};
