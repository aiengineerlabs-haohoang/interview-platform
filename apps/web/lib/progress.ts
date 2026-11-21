import { AVATARS, QUESTIONS, newAnonId, type Avatar, type Question } from "@tower/shared";
import { z } from "zod";

export interface MemoryStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = "tower:v1";

const ProgressSchema = z.object({
  anonId: z.string().regex(/^[0-9a-f]{32}$/),
  avatar: z.enum(AVATARS),
  attempts: z.record(
    z.string(),
    z.object({ best: z.number().int().min(0).max(100), last: z.number().int().min(0).max(100), day: z.string(), count: z.number().int().min(1) }),
  ),
  streak: z.object({ count: z.number().int().min(0), lastDay: z.string().nullable() }),
});
export type Progress = z.infer<typeof ProgressSchema>;

function fresh(random: () => number = Math.random): Progress {
  return { anonId: newAnonId(), avatar: AVATARS[Math.floor(random() * AVATARS.length)]!, attempts: {}, streak: { count: 0, lastDay: null } };
}

/** Storage can be missing, full, blocked or hand-edited. None of that may stop the page from loading. */
export function loadProgress(store: MemoryStore): Progress {
  let raw: string | null = null;
  try {
    raw = store.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw) {
    try {
      const parsed = ProgressSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      /* fall through to a fresh visitor */
    }
  }
  const p = fresh();
  saveProgress(store, p);
  return p;
}

export function saveProgress(store: MemoryStore, p: Progress): void {
  try {
    store.setItem(KEY, JSON.stringify(p));
  } catch {
    /* a private window keeps nothing; the session still works */
  }
}

function previousDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

export function recordAttempt(p: Progress, questionId: string, score: number, day: string): Progress {
  const prev = p.attempts[questionId];
  const attempts = {
    ...p.attempts,
    [questionId]: { best: Math.max(prev?.best ?? 0, score), last: score, day, count: (prev?.count ?? 0) + 1 },
  };
  let streak = p.streak;
  if (streak.lastDay !== day) streak = { count: streak.lastDay === previousDay(day) ? streak.count + 1 : 1, lastDay: day };
  return { ...p, attempts, streak };
}

/** Unattempted questions first, then the weakest. Never the question just finished unless it is the only one. */
export function pickNext(roomId: string, p: Progress, justDone: string | undefined, bank: readonly Question[] = QUESTIONS): Question {
  const inRoom = bank.filter((q) => q.room === roomId);
  if (inRoom.length === 0) throw new Error(`no questions in ${roomId}`);
  const pool = inRoom.length > 1 ? inRoom.filter((q) => q.id !== justDone) : inRoom;
  const fresh = pool.find((q) => !p.attempts[q.id]);
  if (fresh) return fresh;
  return [...pool].sort((a, b) => (p.attempts[a.id]!.best - p.attempts[b.id]!.best) || inRoom.indexOf(a) - inRoom.indexOf(b))[0]!;
}

export type { Avatar };
