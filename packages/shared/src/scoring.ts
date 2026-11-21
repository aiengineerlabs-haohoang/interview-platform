import type { Expression, Question } from "./types";
import { compilePattern, normalise, wordCount } from "./text";

export interface PointResult {
  id: string;
  label: string;
  weight: number;
  hit: boolean;
}

export interface Grade {
  points: PointResult[];
  score: number;
  trapped: boolean;
  tooShort: boolean;
  verdict: Verdict;
}

export type Verdict = "strong-hire" | "hire" | "lean-no" | "no-hire";

/** Fewer words than this and a keyword rubric is measuring nothing. */
export const MIN_WORDS = 12;

export function verdictFor(score: number, trapped: boolean): Verdict {
  if (trapped) return "no-hire";
  if (score >= 80) return "strong-hire";
  if (score >= 55) return "hire";
  if (score >= 30) return "lean-no";
  return "no-hire";
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  "strong-hire": "Strong hire",
  hire: "Hire",
  "lean-no": "Lean no hire",
  "no-hire": "No hire",
};

export function expressionFor(verdict: Verdict): Expression {
  switch (verdict) {
    case "strong-hire":
      return "warm";
    case "hire":
      return "confident";
    case "lean-no":
      return "thinking";
    case "no-hire":
      return "confused";
  }
}

export function scoreFromHits(points: readonly { weight: number; hit: boolean }[]): number {
  const total = points.reduce((s, p) => s + p.weight, 0);
  if (total === 0) return 0;
  const got = points.reduce((s, p) => s + (p.hit ? p.weight : 0), 0);
  return Math.round((100 * got) / total);
}

/** Grade an answer against a question's rubric. Deterministic, offline, and honest about being keyword-based. */
export function grade(question: Question, answer: string): Grade {
  const text = normalise(answer);
  const tooShort = wordCount(answer) < MIN_WORDS;
  const points: PointResult[] = question.points.map((p) => ({
    id: p.id,
    label: p.label,
    weight: p.weight,
    hit: !tooShort && p.patterns.some((pat) => compilePattern(pat).test(text)),
  }));
  const score = scoreFromHits(points);
  const sprung = !tooShort && question.trap.patterns.some((pat) => compilePattern(pat).test(text));
  const trapped = sprung && score < 50;
  return { points, score, trapped, tooShort, verdict: verdictFor(score, trapped) };
}

/** Re-score after the candidate corrects the checklist by hand. */
export function regrade(base: Grade, hitById: Record<string, boolean>): Grade {
  const points = base.points.map((p) => ({ ...p, hit: hitById[p.id] ?? p.hit }));
  const score = scoreFromHits(points);
  const trapped = base.trapped && score < 50;
  return { ...base, points, score, trapped, verdict: verdictFor(score, trapped) };
}
