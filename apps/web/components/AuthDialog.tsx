"use client";

import { AVATAR_MODELS, RegisterInputSchema, type AvatarModel, type UserAvatar } from "@tower/shared";
import clsx from "clsx";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth";

type Mode = "signin" | "register";

interface Props {
  open: boolean;
  onClose: () => void;
  initialMode?: Mode;
}

/** The hue each model starts from; the slider turns it. Previews are initials in this colour, the real art is the stage's job. */
const BASE_HUE: Record<AvatarModel, number> = { sakura: 340, ren: 210, hana: 130, kai: 30 };
const LABEL: Record<AvatarModel, string> = { sakura: "Sakura", ren: "Ren", hana: "Hana", kai: "Kai" };

export const previewColor = (a: UserAvatar) => `hsl(${(BASE_HUE[a.model] + (a.hue ?? 0)) % 360} 62% 48%)`;

export function AvatarPicker({ value, onChange }: { value: UserAvatar; onChange: (a: UserAvatar) => void }) {
  const hueId = useId();
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Avatar" className="grid grid-cols-4 gap-2">
        {AVATAR_MODELS.map((m) => {
          const selected = value.model === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={LABEL[m]}
              onClick={() => onChange({ ...value, model: m })}
              className={clsx(
                "flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs text-[var(--ink-2)]",
                selected ? "border-[var(--sun)] bg-[var(--sun-soft)]" : "border-[var(--line)] bg-[var(--card)] hover:bg-[var(--tint)]",
              )}
            >
              <span
                aria-hidden
                className="grid size-10 place-items-center rounded-full text-lg font-bold text-white"
                style={{ background: previewColor({ model: m, hue: value.hue }) }}
              >
                {LABEL[m][0]}
              </span>
              {LABEL[m]}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-sm text-[var(--ink-2)]">
        <label htmlFor={hueId} className="shrink-0">
          Hue
        </label>
        <input
          id={hueId}
          type="range"
          min={0}
          max={360}
          step={1}
          value={value.hue ?? 0}
          onChange={(e) => onChange({ ...value, hue: Number(e.target.value) })}
          aria-label="Hue"
          className="w-full accent-[var(--sun)]"
        />
      </div>
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function AuthDialog({ open, onClose, initialMode = "signin" }: Props) {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [avatar, setAvatar] = useState<UserAvatar>({ model: "sakura", hue: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const errorId = useId();
  const box = useRef<HTMLDivElement>(null);
  const userInput = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Start fresh each time it opens; give focus back to whatever opened it when it closes.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    setMode(initialMode);
    setError(null);
    setPassword("");
    setShowPw(false);
    userInput.current?.focus();
    return () => opener?.focus?.();
  }, [open, initialMode]);

  if (!open || typeof document === "undefined") return null;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (e.key !== "Tab" || !box.current) return;
    const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.tabIndex >= 0);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !box.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !box.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  function pick(next: Mode) {
    setMode(next);
    setError(null);
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next: Mode = mode === "signin" ? "register" : "signin";
      pick(next);
      document.getElementById(`${titleId}-${next}`)?.focus();
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (mode === "register") {
      const parsed = RegisterInputSchema.safeParse({ username, password, avatar });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        setError(`${issue?.path[0] === "password" ? "Password" : "Username"}: ${issue?.message ?? "Check what you typed."}`);
        return;
      }
    } else if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setBusy(true);
    const r = mode === "register" ? await auth.register({ username, password, avatar }) : await auth.login({ username: username.trim(), password });
    setBusy(false);
    if (r.ok) {
      setPassword("");
      onClose();
    } else {
      setError(r.error);
    }
  }

  const field =
    "w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-base text-[var(--ink)] outline-none focus:border-[var(--sun)] focus:ring-2 focus:ring-[var(--sun-line)]";
  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      id={`${titleId}-${m}`}
      aria-selected={mode === m}
      aria-controls={`${titleId}-panel`}
      tabIndex={mode === m ? 0 : -1}
      onClick={() => pick(m)}
      onKeyDown={onTabKey}
      className={clsx("flex-1 rounded-full px-4 py-2 text-sm font-semibold", mode === m ? "bg-[var(--sun)] text-white" : "text-[var(--ink-2)] hover:bg-[var(--tint)]")}
    >
      {label}
    </button>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(44,29,20,0.45)] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="paper max-h-full w-full max-w-md overflow-y-auto rounded-2xl p-5"
      >
        <h2 id={titleId} className="font-serif text-2xl text-[var(--ink)]">
          {mode === "signin" ? "Welcome back" : "Join the tower"}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-3)]">An account keeps your progress on every device. Playing as a guest works fine too.</p>

        <div role="tablist" aria-label="Account" className="mt-4 flex gap-1 rounded-full border border-[var(--line)] bg-[var(--tint)] p-1">
          {tab("signin", "Sign in")}
          {tab("register", "Create account")}
        </div>

        <form id={`${titleId}-panel`} role="tabpanel" aria-labelledby={`${titleId}-${mode}`} onSubmit={submit} noValidate className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${titleId}-user`} className="text-sm font-medium text-[var(--ink-2)]">
              Username
            </label>
            <input
              id={`${titleId}-user`}
              ref={userInput}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={64}
              aria-describedby={mode === "register" ? `${titleId}-uhint` : undefined}
              className={field}
            />
            {mode === "register" && (
              <span id={`${titleId}-uhint`} className="text-xs text-[var(--ink-3)]">
                3 to 20 letters, numbers or underscores.
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${titleId}-pw`} className="text-sm font-medium text-[var(--ink-2)]">
              Password
            </label>
            <div className="flex gap-2">
              <input
                id={`${titleId}-pw`}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                maxLength={256}
                aria-describedby={mode === "register" ? `${titleId}-phint` : undefined}
                className={field}
              />
              <button
                type="button"
                aria-pressed={showPw}
                onClick={() => setShowPw((s) => !s)}
                className="shrink-0 rounded-xl border border-[var(--line)] px-3 text-sm text-[var(--ink-2)] hover:bg-[var(--tint)]"
              >
                {showPw ? "Hide password" : "Show password"}
              </button>
            </div>
            {mode === "register" && (
              <span id={`${titleId}-phint`} className="text-xs text-[var(--ink-3)]">
                8 to 72 characters.
              </span>
            )}
          </div>

          {mode === "register" && <AvatarPicker value={avatar} onChange={setAvatar} />}

          {error && (
            <p role="alert" id={errorId} className="rounded-xl border border-[var(--sun-line)] bg-[var(--sun-soft)] px-3 py-2 text-sm text-[var(--sun)]">
              {error}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy} className="rounded-full bg-[var(--sun)] px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
            <button type="button" onClick={onClose} className="ml-auto rounded-full border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--ink-2)] hover:bg-[var(--tint)]">
              Play as guest
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
