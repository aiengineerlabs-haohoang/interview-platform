import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth";

const user = { id: "u1", username: "hao", avatar: { model: "ren" as const, hue: 40 } };
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

function Probe() {
  const a = useAuth();
  return (
    <div>
      <p data-testid="status">{a.status}</p>
      <p data-testid="user">{a.user ? a.user.username : "none"}</p>
      <p data-testid="avatar">{a.user ? JSON.stringify(a.user.avatar) : ""}</p>
      <button onClick={() => void a.register({ username: "hao", password: "password1" }).then((r) => ((document.body.dataset.result = JSON.stringify(r)), 0))}>register</button>
      <button onClick={() => void a.login({ username: "hao", password: "password1" }).then((r) => ((document.body.dataset.result = JSON.stringify(r)), 0))}>login</button>
      <button onClick={() => void a.logout()}>logout</button>
      <button onClick={() => void a.setAvatar({ model: "hana", hue: 90 })}>avatar</button>
    </div>
  );
}

function mockFetch(routes: Record<string, (init?: RequestInit) => Promise<Response>>) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const h = routes[key];
    return h ? h(init) : json({ error: {} }, 404);
  });
  vi.stubGlobal("fetch", f);
  return f;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

const mount = () => render(<AuthProvider><Probe /></AuthProvider>);

describe("useAuth", () => {
  it("starts loading, then is ready with the signed-in user from /api/auth/me", async () => {
    mockFetch({ "GET /api/auth/me": () => json({ user }) });
    mount();
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("user")).toHaveTextContent("hao");
  });

  it("is ready with no user when signed out", async () => {
    mockFetch({ "GET /api/auth/me": () => json({ user: null }) });
    mount();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("keeps working as a guest when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    mount();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("login sends this browser's anon id so its attempts merge, then exposes the user", async () => {
    const f = mockFetch({ "GET /api/auth/me": () => json({ user: null }), "POST /api/auth/login": () => json({ user }) });
    const u = userEvent.setup();
    mount();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    await u.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("hao"));
    const loginCall = f.mock.calls.find((c) => c[0] === "/api/auth/login")!;
    expect(JSON.parse(loginCall[1]!.body as string).anonId).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.parse(document.body.dataset.result!)).toEqual({ ok: true, user });
  });

  it("a failed register keeps the user null and returns the reason", async () => {
    mockFetch({ "GET /api/auth/me": () => json({ user: null }), "POST /api/auth/register": () => json({ error: { code: "username_taken" } }, 409) });
    const u = userEvent.setup();
    mount();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    await u.click(screen.getByText("register"));
    await waitFor(() => expect(document.body.dataset.result).toBeTruthy());
    expect(JSON.parse(document.body.dataset.result!)).toEqual({ ok: false, error: "That username is taken." });
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("logout clears the user even if the server cannot be reached", async () => {
    mockFetch({ "GET /api/auth/me": () => json({ user }), "POST /api/auth/logout": () => Promise.reject(new TypeError("offline")) });
    const u = userEvent.setup();
    mount();
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("hao"));
    await u.click(screen.getByText("logout"));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
  });

  it("setAvatar updates the user from the server's answer", async () => {
    mockFetch({ "GET /api/auth/me": () => json({ user }), "PUT /api/auth/avatar": () => json({ user: { ...user, avatar: { model: "hana", hue: 90 } } }) });
    const u = userEvent.setup();
    mount();
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("hao"));
    await u.click(screen.getByText("avatar"));
    await waitFor(() => expect(screen.getByTestId("avatar")).toHaveTextContent('"hana"'));
  });

  it("throws a clear error outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
