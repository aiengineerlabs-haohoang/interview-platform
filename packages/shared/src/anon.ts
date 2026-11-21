/** A random id for a visitor who never signs in. 32 hex characters. */
export function newAnonId(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return Array.from(random(16), (b) => b.toString(16).padStart(2, "0")).join("");
}
