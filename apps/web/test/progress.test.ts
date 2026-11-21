import { describe, expect, it } from "vitest";
import { QUESTIONS } from "@tower/shared";
import { loadProgress, pickNext, recordAttempt, saveProgress, type MemoryStore } from "@/lib/progress";

function memory(initial: Record<string, string> = {}): MemoryStore & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("loadProgress", () => {
  it("creates an anonymous id and an avatar for a first-time visitor and keeps them", () => {
    const store = memory();
    const a = loadProgress(store);
    expect(a.anonId).toMatch(/^[0-9a-f]{32}$/);
    expect(["owl", "fox", "cat", "rabbit"]).toContain(a.avatar);
    expect(loadProgress(store).anonId).toBe(a.anonId);
  });

  it("survives corrupt storage by starting fresh instead of crashing the page", () => {
    const store = memory({ "tower:v1": "{not json" });
    expect(loadProgress(store).attempts).toEqual({});
  });

  it("survives storage that throws, as in a private window", () => {
    const hostile: MemoryStore = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    const p = loadProgress(hostile);
    expect(p.anonId).toHaveLength(32);
    expect(() => saveProgress(hostile, p)).not.toThrow();
  });

  it("drops stored entries that do not match the shape", () => {
    const store = memory({ "tower:v1": JSON.stringify({ anonId: "x", avatar: "dragon", attempts: { q: { best: 500 } }, streak: "no" }) });
    const p = loadProgress(store);
    expect(p.anonId).toMatch(/^[0-9a-f]{32}$/);
    expect(p.attempts).toEqual({});
  });
});

describe("recordAttempt", () => {
  const base = () => loadProgress(memory());

  it("keeps the best score and remembers the last", () => {
    let p = recordAttempt(base(), "q1", 70, "2026-11-20");
    p = recordAttempt(p, "q1", 40, "2026-11-20");
    expect(p.attempts.q1).toEqual({ best: 70, last: 40, day: "2026-11-20", count: 2 });
  });

  it("starts a streak at one, extends it on consecutive days and holds it within a day", () => {
    let p = recordAttempt(base(), "q1", 50, "2026-11-20");
    expect(p.streak).toEqual({ count: 1, lastDay: "2026-11-20" });
    p = recordAttempt(p, "q2", 50, "2026-11-20");
    expect(p.streak.count).toBe(1);
    p = recordAttempt(p, "q3", 50, "2026-11-21");
    expect(p.streak).toEqual({ count: 2, lastDay: "2026-11-21" });
  });

  it("resets the streak after a missed day", () => {
    let p = recordAttempt(base(), "q1", 50, "2026-11-20");
    p = recordAttempt(p, "q1", 50, "2026-11-22");
    expect(p.streak).toEqual({ count: 1, lastDay: "2026-11-22" });
  });

  it("counts across a month boundary", () => {
    let p = recordAttempt(base(), "q1", 50, "2026-11-30");
    p = recordAttempt(p, "q1", 50, "2026-12-01");
    expect(p.streak.count).toBe(2);
  });

  it("does not mutate what it was given", () => {
    const p = base();
    recordAttempt(p, "q1", 50, "2026-11-20");
    expect(p.attempts).toEqual({});
  });
});

describe("pickNext", () => {
  const inRoom = QUESTIONS.filter((q) => q.room === "agents");

  it("offers an unattempted question before a repeat", () => {
    let p = loadProgress(memory());
    p = recordAttempt(p, inRoom[0]!.id, 90, "2026-11-20");
    const next = pickNext("agents", p, undefined);
    expect(next.id).not.toBe(inRoom[0]!.id);
    expect(next.room).toBe("agents");
  });

  it("falls back to the weakest question once all are tried, never the one just finished", () => {
    let p = loadProgress(memory());
    inRoom.forEach((q, i) => (p = recordAttempt(p, q.id, 30 + i * 20, "2026-11-20")));
    expect(pickNext("agents", p, undefined).id).toBe(inRoom[0]!.id);
    expect(pickNext("agents", p, inRoom[0]!.id).id).not.toBe(inRoom[0]!.id);
  });

  it("is stable for the same input", () => {
    const p = loadProgress(memory());
    expect(pickNext("agents", p, undefined).id).toBe(pickNext("agents", p, undefined).id);
  });
});
