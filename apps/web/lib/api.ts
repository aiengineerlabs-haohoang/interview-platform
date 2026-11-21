import type { AttemptInput, PresenceInput } from "@tower/shared";
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

/** The product works without the network: every call resolves to null instead of throwing. */
async function call<T>(path: string, schema: z.ZodType<T>, body?: unknown, fetcher: typeof fetch = fetch): Promise<T | null> {
  try {
    const res = await fetcher(path, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const api = {
  presence: (fetcher?: typeof fetch) => call("/api/presence", PresenceSchema, undefined, fetcher),
  heartbeat: (input: PresenceInput, fetcher?: typeof fetch) => call("/api/presence", PresenceSchema, input, fetcher),
  attempt: (input: AttemptInput, fetcher?: typeof fetch) => call("/api/attempts", AttemptResultSchema, input, fetcher),
  daily: (fetcher?: typeof fetch) => call("/api/daily", DailySchema, undefined, fetcher),
};
