export function err(code: string, message: string, extra: Record<string, unknown> = {}) {
  return { error: { code, message, ...extra } };
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; body: ReturnType<typeof err> };

export async function parseBody<T>(req: Request, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }): Promise<Parsed<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, body: err("invalid_body", "The body is not valid JSON.") };
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    return { ok: false, body: err("invalid_body", "The body does not match.", { issues: r.error.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`) }) };
  }
  return { ok: true, data: r.data };
}
