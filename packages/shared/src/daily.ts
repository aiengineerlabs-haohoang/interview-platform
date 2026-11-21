import type { Question } from "./types";

/** UTC date as YYYY-MM-DD. The daily question changes for everyone at the same moment. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Everyone gets the same question on the same UTC day; it cycles through the whole bank before repeating. */
export function dailyQuestion(questions: readonly Question[], day: string): Question {
  if (questions.length === 0) throw new Error("no questions");
  const sorted = [...questions].sort((a, b) => a.id.localeCompare(b.id));
  const epoch = Date.UTC(2026, 0, 1);
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const n = Math.floor((Date.UTC(y, m - 1, d) - epoch) / 86_400_000);
  // One shuffled lap per cycle so the order is not alphabetical but never repeats inside a lap.
  const lap = Math.floor(n / sorted.length);
  const order = sorted.map((q) => ({ q, k: hash(`${lap}:${q.id}`) })).sort((a, b) => a.k - b.k || a.q.id.localeCompare(b.q.id));
  const idx = ((n % sorted.length) + sorted.length) % sorted.length;
  return order[idx]!.q;
}
