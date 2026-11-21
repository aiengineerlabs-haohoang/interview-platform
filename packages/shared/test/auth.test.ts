import { describe, expect, it } from "vitest";
import { AvatarSchema, AvatarUpdateSchema, LoginInputSchema, PublicUserSchema, RegisterInputSchema } from "../src";

const ok = { username: "hao_01", password: "correct horse" };

describe("RegisterInputSchema", () => {
  it("accepts a plain registration", () => expect(RegisterInputSchema.safeParse(ok).success).toBe(true));
  it("accepts an anon id and an avatar", () =>
    expect(RegisterInputSchema.safeParse({ ...ok, anonId: "a".repeat(32), avatar: { model: "kai", hue: 200 } }).success).toBe(true));
  it.each(["ab", "a".repeat(21), "has space", "emoji😀x", "dash-name", ""])("rejects username %j", (username) =>
    expect(RegisterInputSchema.safeParse({ ...ok, username }).success).toBe(false));
  it("allows the 3 and 20 character limits", () => {
    expect(RegisterInputSchema.safeParse({ ...ok, username: "abc" }).success).toBe(true);
    expect(RegisterInputSchema.safeParse({ ...ok, username: "a".repeat(20) }).success).toBe(true);
  });
  it("enforces password 8 to 72", () => {
    expect(RegisterInputSchema.safeParse({ ...ok, password: "1234567" }).success).toBe(false);
    expect(RegisterInputSchema.safeParse({ ...ok, password: "12345678" }).success).toBe(true);
    expect(RegisterInputSchema.safeParse({ ...ok, password: "x".repeat(72) }).success).toBe(true);
    expect(RegisterInputSchema.safeParse({ ...ok, password: "x".repeat(73) }).success).toBe(false);
  });
  it("rejects a malformed anon id", () => expect(RegisterInputSchema.safeParse({ ...ok, anonId: "u:x" }).success).toBe(false));
});

describe("LoginInputSchema", () => {
  it("needs both fields", () => {
    expect(LoginInputSchema.safeParse({ username: "a", password: "b" }).success).toBe(true);
    expect(LoginInputSchema.safeParse({ username: "a" }).success).toBe(false);
    expect(LoginInputSchema.safeParse({ username: "", password: "b" }).success).toBe(false);
  });
});

describe("AvatarSchema", () => {
  it("accepts each model, with or without hue", () => {
    for (const model of ["sakura", "ren", "hana", "kai"]) expect(AvatarSchema.safeParse({ model }).success).toBe(true);
    expect(AvatarSchema.safeParse({ model: "ren", hue: 0 }).success).toBe(true);
    expect(AvatarSchema.safeParse({ model: "ren", hue: 360 }).success).toBe(true);
  });
  it("rejects an unknown model or an out-of-range hue", () => {
    expect(AvatarSchema.safeParse({ model: "owl" }).success).toBe(false);
    expect(AvatarSchema.safeParse({ model: "ren", hue: 361 }).success).toBe(false);
    expect(AvatarSchema.safeParse({ model: "ren", hue: -1 }).success).toBe(false);
    expect(AvatarSchema.safeParse({ hue: 10 }).success).toBe(false);
  });
  it("wraps in AvatarUpdateSchema", () => expect(AvatarUpdateSchema.safeParse({ avatar: { model: "hana" } }).success).toBe(true));
});

describe("PublicUserSchema", () => {
  it("strips anything but id, username and avatar", () => {
    const r = PublicUserSchema.parse({ id: "1", username: "a", avatar: { model: "kai" }, password_hash: "x", salt: "y" });
    expect(r).toEqual({ id: "1", username: "a", avatar: { model: "kai" } });
  });
});
