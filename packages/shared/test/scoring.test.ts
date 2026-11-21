import { describe, expect, it } from "vitest";
import { MIN_WORDS, expressionFor, grade, regrade, scoreFromHits, verdictFor, type Question } from "../src";

const q: Question = {
  id: "demo-question",
  room: "llm-inference",
  level: "senior",
  title: "A demo question",
  prompt: "You are asked something specific about caching and prefixes in a long interview prompt.",
  trap: { saying: "The cache must be broken.", whyWrong: "The provider is doing exactly what it is designed to do.", patterns: ["cache (is )?broken"] },
  points: [
    { id: "prefix", label: "Caching is a prefix match", weight: 3, patterns: ["prefix"] },
    { id: "append", label: "Keep the context append only", weight: 2, patterns: ["append[ -]?only", "append"] },
    { id: "ttl", label: "Breakpoints expire", weight: 1, patterns: ["\\bttl\\b", "expire"] },
  ],
  mechanism: "The KV cache reuses the longest common prefix of the context and nothing else, so one early change misses everything after it.",
  clincher: "Prompt caching is a prefix match, so keep the context append only and freeze the front.",
  seconds: 180,
};

const long = (s: string) => `${s} ${"filler words to pass the minimum length ".repeat(2)}`;

describe("grade", () => {
  it("scores weighted coverage", () => {
    const g = grade(q, long("It is a prefix match so we keep it append-only"));
    expect(g.points.filter((p) => p.hit).map((p) => p.id)).toEqual(["prefix", "append"]);
    expect(g.score).toBe(83);
    expect(g.verdict).toBe("strong-hire");
  });

  it("normalises case, hyphens and punctuation", () => {
    const g = grade(q, long("PREFIX!!! Append_only, and the TTL."));
    expect(g.score).toBe(100);
  });

  it("treats an answer under the minimum length as empty rather than guessing", () => {
    const g = grade(q, "prefix append ttl");
    expect(g.tooShort).toBe(true);
    expect(g.score).toBe(0);
    expect("prefix append ttl".split(" ").length).toBeLessThan(MIN_WORDS);
  });

  it("calls the trap only when the answer springs it and misses the mechanism", () => {
    const sprung = grade(q, long("I think the cache is broken here"));
    expect(sprung.trapped).toBe(true);
    expect(sprung.verdict).toBe("no-hire");
    const recovered = grade(q, long("The cache is broken is what people say but really it is a prefix match and you should append only, it can expire"));
    expect(recovered.trapped).toBe(false);
  });
});

describe("regrade", () => {
  it("lets the candidate overrule the keyword match, in both directions", () => {
    const g = grade(q, long("It is a prefix match"));
    expect(g.score).toBe(50);
    const up = regrade(g, { ttl: true, append: true });
    expect(up.score).toBe(100);
    const down = regrade(g, { prefix: false });
    expect(down.score).toBe(0);
  });
});

describe("verdicts", () => {
  it("has thresholds that never overlap", () => {
    expect(verdictFor(100, false)).toBe("strong-hire");
    expect(verdictFor(80, false)).toBe("strong-hire");
    expect(verdictFor(79, false)).toBe("hire");
    expect(verdictFor(55, false)).toBe("hire");
    expect(verdictFor(54, false)).toBe("lean-no");
    expect(verdictFor(30, false)).toBe("lean-no");
    expect(verdictFor(29, false)).toBe("no-hire");
    expect(verdictFor(100, true)).toBe("no-hire");
  });

  it("maps every verdict to an expression the character has", () => {
    expect(expressionFor("strong-hire")).toBe("warm");
    expect(expressionFor("no-hire")).toBe("confused");
  });

  it("scores zero when there is nothing to score", () => {
    expect(scoreFromHits([])).toBe(0);
  });
});
