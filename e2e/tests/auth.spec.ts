import { expect, test } from "@playwright/test";

// API only, through Playwright's cookie-keeping request context: no UI, so it survives a redesign of the page.
const json = { "content-type": "application/json" };

test("register, stay signed in across a 'reload', log out, log in again", async ({ playwright, baseURL }) => {
  const username = `e2e_${Date.now().toString(36)}`.slice(0, 20);
  const password = "e2e-password-123";
  const anonId = "e2e0".repeat(8);

  const api = await playwright.request.newContext({ baseURL });
  const attempt = await api.post("/api/attempts", { headers: json, data: { anonId, questionId: "tool-failure-loop", score: 61, seconds: 40 } });
  expect(attempt.ok()).toBeTruthy();

  const reg = await api.post("/api/auth/register", { headers: json, data: { username, password, anonId, avatar: { model: "ren", hue: 90 } } });
  expect(reg.status()).toBe(201);
  const regBody = await reg.json();
  expect(regBody.user).toMatchObject({ username, avatar: { model: "ren", hue: 90 } });
  expect(JSON.stringify(regBody)).not.toMatch(/password|salt|u:/);
  const setCookie = reg.headers()["set-cookie"] ?? "";
  expect(setCookie).toMatch(/tower_session=/);
  expect(setCookie).toMatch(/HttpOnly/i);

  // A "reload" is a new request that carries the same cookie jar.
  const me = await (await api.get("/api/auth/me")).json();
  expect(me.user.username).toBe(username);

  // The anonymous attempt moved to the account and is visible on "another device" after login.
  const mine = await (await api.get("/api/me/attempts")).json();
  expect(mine.attempts).toEqual([expect.objectContaining({ questionId: "tool-failure-loop", score: 61 })]);

  const out = await api.post("/api/auth/logout", { headers: json, data: {} });
  expect(out.ok()).toBeTruthy();
  expect((await (await api.get("/api/auth/me")).json()).user).toBeNull();
  expect((await api.get("/api/me/attempts")).status()).toBe(401);

  const bad = await api.post("/api/auth/login", { headers: json, data: { username, password: "wrong-password" } });
  expect(bad.status()).toBe(401);

  const again = await api.post("/api/auth/login", { headers: json, data: { username: username.toUpperCase(), password } });
  expect(again.status()).toBe(200);
  expect((await (await api.get("/api/auth/me")).json()).user.username).toBe(username);

  const device2 = await playwright.request.newContext({ baseURL });
  expect((await (await device2.get("/api/auth/me")).json()).user).toBeNull();
  await device2.post("/api/auth/login", { headers: json, data: { username, password } });
  expect((await (await device2.get("/api/me/attempts")).json()).attempts).toHaveLength(1);

  await api.dispose();
  await device2.dispose();
});

test("a duplicate username is a 409 and a cross-site post is refused", async ({ request }) => {
  const username = `dup_${Date.now().toString(36)}`.slice(0, 20);
  const data = { username, password: "e2e-password-123" };
  expect((await request.post("/api/auth/register", { headers: json, data })).status()).toBe(201);
  expect((await request.post("/api/auth/register", { headers: json, data: { ...data, username: username.toUpperCase() } })).status()).toBe(409);
  expect((await request.post("/api/auth/login", { headers: { ...json, origin: "https://evil.example" }, data })).status()).toBe(403);
});
