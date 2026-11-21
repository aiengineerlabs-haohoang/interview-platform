import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthDialog } from "@/components/AuthDialog";
import { AuthProvider } from "@/lib/auth";

const user = { id: "u1", username: "hao", avatar: { model: "kai" as const, hue: 120 } };
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

function setup(routes: Record<string, (init?: RequestInit) => Promise<Response>> = {}, props: Partial<React.ComponentProps<typeof AuthDialog>> = {}) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    const h = routes[`${init?.method ?? "GET"} ${url}`];
    return h ? h(init) : json({ user: null });
  });
  vi.stubGlobal("fetch", f);
  const onClose = vi.fn();
  render(
    <AuthProvider>
      <button>outside</button>
      <AuthDialog open onClose={onClose} {...props} />
    </AuthProvider>,
  );
  return { f, onClose, u: userEvent.setup() };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("AuthDialog", () => {
  it("renders nothing when closed", () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ user: null })));
    render(<AuthProvider><AuthDialog open={false} onClose={() => {}} /></AuthProvider>);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is a labelled modal dialog with sign in and create account tabs, sign in first", () => {
    setup();
    const d = screen.getByRole("dialog");
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(d).toHaveAccessibleName();
    expect(screen.getByRole("tab", { name: "Sign in" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Create account" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("moves focus into the dialog and closes on Escape", async () => {
    const { u, onClose } = setup();
    await waitFor(() => expect(screen.getByLabelText("Username")).toHaveFocus());
    await u.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("traps Tab and Shift+Tab inside the dialog", async () => {
    const { u } = setup();
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 12; i++) {
      await u.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 12; i++) {
      await u.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("toggles password visibility", async () => {
    const { u } = setup();
    await u.click(screen.getByRole("button", { name: /show password/i }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    await u.click(screen.getByRole("button", { name: /hide password/i }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("'Play as guest' closes without calling the API", async () => {
    const { u, onClose, f } = setup();
    await u.click(screen.getByRole("button", { name: "Play as guest" }));
    expect(onClose).toHaveBeenCalled();
    expect(f.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toHaveLength(0);
  });

  it("signs in and closes", async () => {
    const { u, onClose, f } = setup({ "POST /api/auth/login": () => json({ user }) });
    await u.type(screen.getByLabelText("Username"), "hao");
    await u.type(screen.getByLabelText("Password"), "password1");
    await u.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const call = f.mock.calls.find((c) => c[0] === "/api/auth/login")!;
    expect(JSON.parse((call[1] as RequestInit).body as string)).toMatchObject({ username: "hao", password: "password1" });
  });

  it("shows a bad login inline and stays open", async () => {
    const { u, onClose } = setup({ "POST /api/auth/login": () => json({ error: { code: "bad_credentials" } }, 401) });
    await u.type(screen.getByLabelText("Username"), "hao");
    await u.type(screen.getByLabelText("Password"), "wrongwrong");
    await u.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong username or password.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("create account validates before sending", async () => {
    const { u, f } = setup();
    await u.click(screen.getByRole("tab", { name: "Create account" }));
    await u.type(screen.getByLabelText("Username"), "a b");
    await u.type(screen.getByLabelText("Password"), "short");
    await u.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(f.mock.calls.some((c) => c[0] === "/api/auth/register")).toBe(false);
  });

  it("create account sends the chosen avatar model and hue", async () => {
    const { u, f, onClose } = setup({ "POST /api/auth/register": () => json({ user }, 201) });
    await u.click(screen.getByRole("tab", { name: "Create account" }));
    await u.type(screen.getByLabelText("Username"), "hao_1");
    await u.type(screen.getByLabelText("Password"), "password1");
    await u.click(screen.getByRole("radio", { name: /kai/i }));
    const slider = screen.getByRole("slider", { name: /hue/i });
    fireEvent.change(slider, { target: { value: "200" } });
    await u.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const call = f.mock.calls.find((c) => c[0] === "/api/auth/register")!;
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.avatar.model).toBe("kai");
    expect(body.avatar.hue).toBe(200);
    expect(body.anonId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("shows a taken username inline", async () => {
    const { u } = setup({ "POST /api/auth/register": () => json({ error: { code: "username_taken" } }, 409) });
    await u.click(screen.getByRole("tab", { name: "Create account" }));
    await u.type(screen.getByLabelText("Username"), "hao_1");
    await u.type(screen.getByLabelText("Password"), "password1");
    await u.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("taken");
  });

  it("only offers the avatar picker when creating an account", async () => {
    const { u } = setup();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    await u.click(screen.getByRole("tab", { name: "Create account" }));
    expect(screen.getByRole("radiogroup", { name: /avatar/i })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("restores focus to the opener when it closes", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ user: null })));
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <AuthProvider>
          <button onClick={() => setOpen(true)}>open</button>
          <AuthDialog open={open} onClose={() => setOpen(false)} />
        </AuthProvider>
      );
    }
    const u = userEvent.setup();
    render(<Host />);
    await u.click(screen.getByText("open"));
    await u.keyboard("{Escape}");
    await waitFor(() => expect(screen.getByText("open")).toHaveFocus());
  });
});
