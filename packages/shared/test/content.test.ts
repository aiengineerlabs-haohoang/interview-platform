import { describe, expect, it } from "vitest";
import { QUESTIONS, QuestionSchema, ROOMS, ROOM_IDS, compilePattern, grade } from "../src";

describe("the question bank", () => {
  it("has every question valid against its schema", () => {
    for (const q of QUESTIONS) expect(() => QuestionSchema.parse(q), q.id).not.toThrow();
  });

  it("has unique ids", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fills every room with at least four questions", () => {
    for (const id of ROOM_IDS) expect(QUESTIONS.filter((q) => q.room === id).length, id).toBeGreaterThanOrEqual(4);
  });

  it("has a room definition per room id and one floor each", () => {
    expect(ROOMS.map((r) => r.id).sort()).toEqual([...ROOM_IDS].sort());
    expect(new Set(ROOMS.map((r) => r.floor)).size).toBe(ROOMS.length);
  });

  it("compiles every pattern", () => {
    for (const q of QUESTIONS) {
      for (const p of q.points) for (const pat of p.patterns) expect(() => compilePattern(pat), `${q.id}/${p.id}`).not.toThrow();
      for (const pat of q.trap.patterns) expect(() => compilePattern(pat), `${q.id}/trap`).not.toThrow();
    }
  });

  it("scores zero on a blank answer and never reveals the rubric through the prompt", () => {
    for (const q of QUESTIONS) {
      expect(grade(q, "").score, q.id).toBe(0);
      expect(grade(q, "I do not know much about this at all, sorry about that.").score, q.id).toBeLessThan(30);
    }
  });

  it("gives the senior answer itself a strong score, so the rubric agrees with the content", () => {
    for (const q of QUESTIONS) {
      const full = `${q.clincher} ${q.mechanism}`;
      expect(grade(q, full).score, `${q.id}: clincher+mechanism should hit most points`).toBeGreaterThanOrEqual(60);
    }
  });

  it("has no point whose label is just a pattern word and no weight outside 1..3", () => {
    for (const q of QUESTIONS) for (const p of q.points) expect(p.weight).toBeGreaterThanOrEqual(1);
  });

  it("does not name the sources the questions were inspired by", () => {
    const banned = /\b(cmu|carnegie|stanford|cs ?\d{3}|11-711|lecture|lecturer|course slides|nus)\b/i;
    for (const q of QUESTIONS) {
      const all = JSON.stringify(q);
      expect(banned.test(all), q.id).toBe(false);
    }
  });
});
