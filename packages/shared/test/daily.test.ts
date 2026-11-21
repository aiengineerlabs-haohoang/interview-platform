import { describe, expect, it } from "vitest";
import { QUESTIONS, dailyQuestion, dayKey, newAnonId } from "../src";

describe("dailyQuestion", () => {
  it("gives everyone the same question on the same day", () => {
    expect(dailyQuestion(QUESTIONS, "2026-11-21").id).toBe(dailyQuestion(QUESTIONS, "2026-11-21").id);
  });

  it("never repeats inside one lap of the bank", () => {
    // Laps are aligned to days since 2026-01-01, so start exactly on a lap boundary.
    const seen = new Set<string>();
    for (let i = 0; i < QUESTIONS.length; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + QUESTIONS.length * 3 + i));
      seen.add(dailyQuestion(QUESTIONS, dayKey(d)).id);
    }
    expect(seen.size).toBe(QUESTIONS.length);
  });

  it("is not stuck on one question", () => {
    const ids = new Set([1, 2, 3, 4, 5].map((d) => dailyQuestion(QUESTIONS, `2026-11-0${d}`).id));
    expect(ids.size).toBeGreaterThan(1);
  });

  it("keys the day in UTC", () => {
    expect(dayKey(new Date("2026-11-21T23:59:59Z"))).toBe("2026-11-21");
    expect(dayKey(new Date("2026-11-22T00:00:00Z"))).toBe("2026-11-22");
  });

  it("throws on an empty bank", () => {
    expect(() => dailyQuestion([], "2026-11-21")).toThrow();
  });
});

describe("newAnonId", () => {
  it("is 32 hex characters and different each time", () => {
    const a = newAnonId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(newAnonId()).not.toBe(a);
  });
});
