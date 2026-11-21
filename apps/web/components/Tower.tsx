"use client";

import { QUESTIONS, ROOMS, dailyQuestion, dayKey, questionById, roomById, type Expression, type Question, type RoomId } from "@tower/shared";
import clsx from "clsx";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type PresenceState } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loadProgress, pickNext, recordAttempt, saveProgress, type Progress } from "@/lib/progress";
import { AuthDialog } from "./AuthDialog";
import { InterviewPanel, type ResultReport } from "./InterviewPanel";
import { webglAvailable, type SceneName } from "./stage/support";
import { modelForAvatar, type ModelId } from "./stage/world/vrm";
import { TouchPad } from "./TouchPad";

const Stage = dynamic(() => import("./stage/Stage"), { ssr: false });

const HEARTBEAT_MS = 20_000;
const FADE_MS = 380;

function browserStore() {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined };
  }
}

export function Tower() {
  const auth = useAuth();
  const [scene, setScene] = useState<SceneName>("plaza");
  const [roomId, setRoomId] = useState<RoomId | null>(null);
  const [startAt, setStartAt] = useState<RoomId | null>(null);
  const [near, setNear] = useState<RoomId | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [expression, setExpression] = useState<Expression>("neutral");
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [presence, setPresence] = useState<PresenceState | null>(null);
  const [stage, setStage] = useState<"checking" | "on" | "off">("checking");
  const [reduced, setReduced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [intro, setIntro] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const progressRef = useRef<Progress | null>(null);
  progressRef.current = progress;

  const today = useMemo(() => dailyQuestion(QUESTIONS, dayKey(new Date())), []);

  // First paint on the client: who is this visitor, can we draw 3D, and did they arrive on a shared question?
  useEffect(() => {
    const p = loadProgress(browserStore());
    setProgress(p);
    setReduced(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
    const ok = webglAvailable();
    setStage(ok ? "on" : "off");
    setListOpen(!ok);
    const shared = new URLSearchParams(window.location.search).get("q");
    const q = shared ? questionById(shared) : undefined;
    if (q) {
      setQuestion(q);
      setRoomId(q.room);
      setStartAt(q.room);
      setScene("room");
      setIntro(false);
    }
  }, []);

  // Signing in on a new device: bring the account's past attempts into this browser's progress.
  const userId = auth.user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void api.myAttempts().then((list) => {
      if (!alive || !list || list.length === 0) return;
      const base = progressRef.current;
      if (!base) return;
      const attempts = { ...base.attempts };
      for (const a of list) {
        const prev = attempts[a.questionId];
        attempts[a.questionId] = prev ? { ...prev, best: Math.max(prev.best, a.score) } : { best: a.score, last: a.score, day: a.day, count: 1 };
      }
      const next = { ...base, attempts };
      setProgress(next);
      saveProgress(browserStore(), next);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  // Heartbeat: tells the campus this visitor is here, and which room they are in.
  const room = scene === "room" ? roomId : null;
  useEffect(() => {
    if (!progress) return;
    let alive = true;
    const beat = async () => {
      if (document.hidden) return;
      const state = await api.heartbeat({ anonId: progress.anonId, room, avatar: progress.avatar });
      if (alive && state) setPresence(state);
    };
    void beat();
    const t = setInterval(beat, HEARTBEAT_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [progress?.anonId, progress?.avatar, room, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback(
    (fn: () => void) => {
      setFading(true);
      window.setTimeout(
        () => {
          fn();
          setFading(false);
        },
        reduced ? 0 : FADE_MS,
      );
    },
    [reduced],
  );

  const openQuestion = useCallback(
    (q: Question) =>
      go(() => {
        setNear(null);
        setQuestion(q);
        setRoomId(q.room);
        setStartAt(q.room);
        setExpression("neutral");
        setIntro(false);
        setScene("room");
        window.history.replaceState(null, "", `?q=${q.id}`);
      }),
    [go],
  );

  const leaveToPlaza = useCallback(
    () =>
      go(() => {
        setQuestion(null);
        setRoomId(null);
        setNear(null);
        setExpression("neutral");
        setScene("plaza");
        window.history.replaceState(null, "", window.location.pathname);
      }),
    [go],
  );

  const enterTower = useCallback((id: RoomId) => openQuestion(pickNext(id, progressRef.current ?? loadProgress(browserStore()), undefined)), [openQuestion]);

  const report = useCallback(async (r: ResultReport) => {
    const day = dayKey(new Date());
    const base = progressRef.current;
    if (base) {
      const next = recordAttempt(base, r.questionId, r.score, day);
      setProgress(next);
      saveProgress(browserStore(), next);
    }
    return api.attempt({ anonId: base?.anonId ?? "00000000", questionId: r.questionId, score: r.score, seconds: r.seconds });
  }, []);

  const next = useCallback(() => {
    if (!question || !progressRef.current) return;
    openQuestion(pickNext(question.room, progressRef.current, question.id));
  }, [question, openQuestion]);

  const share = useCallback(async () => {
    if (!question) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?q=${question.id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the address bar already has the link */
    }
  }, [question]);

  const online = presence?.online ?? 0;
  const done = (id: string) => progress?.attempts[id];
  const roomInfo = roomId ? roomById(roomId) : undefined;
  const nearInfo = near ? roomById(near) : undefined;
  const model: ModelId = auth.user?.avatar?.model ?? modelForAvatar(progress?.avatar);
  const visitors = presence?.visitors ?? [];

  return (
    <div className="absolute inset-0 overflow-hidden" data-scene={scene} data-stage={stage}>
      {stage === "on" && (
        <div className="absolute inset-0">
          <Stage
            scene={scene}
            roomId={roomId}
            roomColor={roomInfo?.color ?? "#c9962b"}
            expression={expression}
            model={model}
            visitors={visitors}
            rooms={presence?.rooms ?? {}}
            startAt={startAt}
            reduced={reduced}
            controls={scene === "plaza" && !authOpen}
            onNear={setNear}
            onEnter={enterTower}
            onFailed={() => setStage("off")}
          />
        </div>
      )}
      {stage !== "on" && <div className="absolute inset-0 bg-[#e9dcc4] bg-cover bg-center" style={{ backgroundImage: "url(/world/window_view.webp)" }} />}

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <header className="pointer-events-auto flex flex-wrap items-center gap-2 p-3 sm:gap-3 sm:p-4">
          {scene === "plaza" ? (
            <span className="paper rounded-full px-4 py-2 font-serif text-lg font-bold">Interview Tower</span>
          ) : (
            <button onClick={leaveToPlaza} className="paper rounded-full px-4 py-2 font-serif text-lg font-bold" aria-label="Interview Tower: back outside">
              Interview Tower
            </button>
          )}
          <span className="paper rounded-full px-3 py-1.5 text-sm text-[var(--ink-2)]" data-testid="online">
            {online > 0 ? `${online} ${online === 1 ? "person" : "people"} on campus` : "Quiet right now"}
          </span>
          {progress && progress.streak.count > 0 && (
            <span className="paper rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--sun)]" data-testid="streak">
              {progress.streak.count}-day streak
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {auth.user ? (
              <>
                <span className="paper rounded-full px-3 py-1.5 text-sm font-semibold" data-testid="who">
                  {auth.user.username}
                </span>
                <button onClick={() => void auth.logout()} className="paper rounded-full px-3 py-1.5 text-sm text-[var(--ink-2)]">
                  Sign out
                </button>
              </>
            ) : (
              auth.status === "ready" && (
                <button onClick={() => setAuthOpen(true)} className="rounded-full bg-[var(--sun)] px-4 py-1.5 text-sm font-semibold text-white shadow">
                  Sign in
                </button>
              )
            )}
          </span>
        </header>

        {scene === "plaza" && (
          <>
            <div className="pointer-events-auto mt-auto flex flex-col gap-2 p-3 sm:max-w-md sm:p-6">
              {nearInfo && (
                <button onClick={() => enterTower(nearInfo.id)} className="paper flex items-center gap-3 rounded-2xl p-3 text-left ring-2 ring-[var(--sun)]" data-testid="enter-prompt">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl font-serif text-lg font-bold text-white" style={{ background: nearInfo.color }} aria-hidden>
                    {nearInfo.floor}
                  </span>
                  <span>
                    <span className="block font-semibold">Enter {nearInfo.name}</span>
                    <span className="block text-sm text-[var(--ink-2)]">Press Enter, or tap here</span>
                  </span>
                </button>
              )}
              {intro ? (
                <div className="paper rounded-3xl p-4 sm:p-5">
                  <h1 className="font-serif text-2xl font-bold leading-tight sm:text-3xl">Walk in. Get asked. Find out where you would have slipped.</h1>
                  <p className="mt-2 text-sm text-[var(--ink-2)] sm:text-base">
                    Five towers of interview rooms for AI engineers. Every question comes with the confident wrong answer, so you can see the trap before you step in it.
                  </p>
                  <p className="mt-2 text-sm text-[var(--ink-2)]">
                    <kbd className="kbd">↑</kbd> <kbd className="kbd">←</kbd> <kbd className="kbd">↓</kbd> <kbd className="kbd">→</kbd> or <kbd className="kbd">W A S D</kbd> to walk, <kbd className="kbd">Shift</kbd> to run, <kbd className="kbd">Q</kbd> <kbd className="kbd">E</kbd> to turn the camera. Walk up to a door and press{" "}
                    <kbd className="kbd">Enter</kbd>.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => setIntro(false)} className="rounded-full bg-[var(--sun)] px-5 py-2.5 font-semibold text-white shadow">
                      Start exploring
                    </button>
                    <button onClick={() => openQuestion(today)} className="rounded-full border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 font-semibold text-[var(--ink)]">
                      Today&apos;s question
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => openQuestion(today)} className="paper rounded-full px-4 py-2 text-sm font-semibold">
                    Today&apos;s question
                  </button>
                  <button onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen} className="paper rounded-full px-4 py-2 text-sm font-semibold">
                    {listOpen ? "Hide towers" : "All towers"}
                  </button>
                  <span className="hidden rounded-full bg-black/35 px-3 py-1.5 text-xs text-white sm:inline">Arrows / WASD walk · Shift run · Q E camera</span>
                </div>
              )}
              <div className="sm:hidden">
                <TouchPad />
              </div>
            </div>

            {listOpen && (
              <div className="pointer-events-auto absolute right-3 top-16 max-h-[60vh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto sm:right-4 sm:top-20">
                <ul className="flex flex-col gap-2" aria-label="Towers">
                  {ROOMS.map((r) => {
                    const qs = QUESTIONS.filter((q) => q.room === r.id);
                    const tried = qs.filter((q) => done(q.id)).length;
                    const inside = presence?.rooms[r.id] ?? 0;
                    return (
                      <li key={r.id}>
                        <button onClick={() => enterTower(r.id)} className="paper flex w-full items-center gap-3 rounded-2xl p-3 text-left" data-room={r.id}>
                          <span className="grid size-11 shrink-0 place-items-center rounded-xl font-serif text-lg font-bold text-white" style={{ background: r.color }} aria-hidden>
                            {r.floor}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-[var(--ink)]">{r.name}</span>
                            <span className="block text-sm text-[var(--ink-2)]">{r.tagline}</span>
                            <span className="mt-0.5 block text-xs text-[var(--ink-3)]">
                              {tried}/{qs.length} tried{inside > 0 ? ` · ${inside} inside` : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}

        {scene === "room" && question && roomInfo && (
          <div className={clsx("pointer-events-auto mt-auto overflow-y-auto p-3 sm:absolute sm:inset-y-0 sm:right-0 sm:mt-0 sm:w-[460px] sm:p-4", "max-h-[60vh] sm:max-h-none")}>
            <div className="paper rounded-3xl p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: roomInfo.color }} aria-hidden>
                  {roomInfo.floor}
                </span>
                <span className="font-semibold">{roomInfo.name}</span>
                <button onClick={share} className="ml-auto rounded-full border border-[var(--line)] px-3 py-1 text-sm text-[var(--ink-2)] hover:bg-[var(--tint)]">
                  {copied ? "Link copied" : "Share this question"}
                </button>
              </div>
              <InterviewPanel key={question.id} question={question} onResult={report} onExpression={setExpression} onNext={next} onLeave={leaveToPlaza} />
            </div>
          </div>
        )}
      </div>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
      <div aria-hidden className={clsx("pointer-events-none absolute inset-0 bg-[#1b1510] transition-opacity", fading ? "opacity-100" : "opacity-0")} style={{ transitionDuration: `${FADE_MS}ms` }} />
    </div>
  );
}
