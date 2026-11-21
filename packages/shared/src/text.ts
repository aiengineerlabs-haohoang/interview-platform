/** Lower-case, hyphens and punctuation to spaces, one space between words. Digits and "." inside numbers stay. */
export function normalise(input: string): string {
  return input
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[-_/]/g, " ")
    .replace(/[^a-z0-9.'%+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(input: string): number {
  const n = normalise(input);
  return n === "" ? 0 : n.split(" ").length;
}

/** Compile a pattern from content. A bad pattern is a content bug, so it throws with the pattern named. */
export function compilePattern(pattern: string): RegExp {
  try {
    return new RegExp(pattern, "i");
  } catch (err) {
    throw new Error(`bad pattern /${pattern}/: ${(err as Error).message}`);
  }
}
