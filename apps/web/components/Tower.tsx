"use client";

import { QUESTIONS, ROOMS, dailyQuestion, dayKey, questionById, roomById, type Expression, type Question, type RoomId } from "@tower/shared";
import clsx from "clsx";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type PresenceState } from "@/lib/api";
import { loadProgress, pickNext, recordAttempt, saveProgress, type Progress } from "@/lib/progress";
import { InterviewPanel, type ResultReport } from "./InterviewPanel";
import { webglAvailable, type SceneName } from "./stage/support";

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
  const [scene, setScene] = useState<SceneName>("outside");
  const [roomId, setRoomId] = useState<RoomId | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [walkTo, setWalkTo] = useState<RoomId | null>(null);
  const [expression, setExpression] = useState<Expression>("neutral");
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [presence, setPresence] = useState<PresenceState | null>(null);
  const [stage, setStage] = useState<"checking" | "on" | "off">("checking");
  const [reduced, setReduced] = useState(false);
  const [copied, setCopied] = useState(false);
  const progressRef = useRef<Progress | null>(null);
  progressRef.current = progress;

  const today = useMemo(() => dailyQuestion(QUESTIONS, dayKey(new Date())), []);

  // First paint on the client: who is this visitor, can we draw 3D, and did they arrive on a shared question?
  useEffect(() => {
    const p = loadProgress(browserStore());
    setProgress(p);
    setReduced(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
    setStage(webglAvailable() ? "on" : "off");
    const shared = new URLSearchParams(window.location.search).get("q");
    const q = shared ? questionById(shared) : undefined;
    if (q) {
      setQuestion(q);
      setRoomId(q.room);
      setScene("room");
    }
  }, []);

  // Heartbeat: tells the building this visitor is here, and which room they are in.
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
  }, [progress?.anonId, progress?.avatar, room]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((fn: () => void) => {
    setFading(true);
    window.setTimeout(() => {
      fn();
      setFading(false);
    }, reduced ? 0 : FADE_MS);
  }, [reduced]);

  const openQuestion = useCallback(
    (q: Question) =>
      go(() => {
        setWalkTo(null);
        setQuestion(q);
        setRoomId(q.room);
        setExpression("neutral");
        setScene("room");
        window.history.replaceState(null, "", `?q=${q.id}`);
      }),
    [go],
  );

  const enter = useCallback(() => go(() => setScene("lobby")), [go]);
  const leaveToLobby = useCallback(
    () =>
      go(() => {
        setQuestion(null);
        setRoomId(null);
        setWalkTo(null);
        setExpression("neutral");
        setScene("lobby");
        window.history.replaceState(null, "", window.location.pathname);
      }),
    [go],
  );
  const leaveTower = useCallback(
    () =>
      go(() => {
        setScene("outside");
        window.history.replaceState(null, "", window.location.pathname);
      }),
    [go],
  );

  const pickRoom = useCallback(
    (id: RoomId) => {
      if (walkTo) return;
      if (stage === "on") setWalkTo(id);
      else openQuestion(pickNext(id, progressRef.current ?? loadProgress(browserStore()), undefined));
    },
    [walkTo, stage, openQuestion],
  );
  const arrived = useCallback((id: RoomId) => openQuestion(pickNext(id, progressRef.current ?? loadProgress(browserStore()), undefined)), [openQuestion]);

  const report = useCallback(
    async (r: ResultReport) => {
      const day = dayKey(new Date());
      const base = progressRef.current;
      if (base) {
        const next = recordAttempt(base, r.questionId, r.score, day);
        setProgress(next);
        saveProgress(browserStore(), next);
      }
      return api.attempt({ anonId: base?.anonId ?? "00000000", questionId: r.questionId, score: r.score, seconds: r.seconds });
    },
    [],
  );

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

  return (
    <div className="absolute inset-0 overflow-hidden" data-scene={scene} data-stage={stage}>
      {stage === "on" && (
        <div className="absolute inset-0">
          <Stage
            scene={scene}
            roomId={roomId}
            expression={expression}
            avatar={progress?.avatar ?? "owl"}
            visitors={presence?.visitors ?? []}
            online={online}
            reduced={reduced}
            walkTo={walkTo}
            onEnter={enter}
            onPickRoom={pickRoom}
            onWalkDone={arrived}
            onFailed={() => setStage("off")}
          />
        </div>
      )}
      {stage !== "on" && (
        <div className="absolute inset-0 grid place-items-end justify-items-center bg-[radial-gradient(ellipse_at_50%_30%,#fff4e0,#e9dcc4_70%)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/characters/interviewer/${scene === "room" ? expression : "warm"}.webp`} alt="" className="mb-0 max-h-[48vh] opacity-95" />
        </div>
      )}

      {/* Overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <header className="pointer-events-auto flex items-center gap-3 p-3 sm:p-4">
          {scene === "outside" ? (
            <span className="paper rounded-full px-4 py-2 font-serif text-lg font-bold">Interview Tower</span>
          ) : (
            <button
              onClick={scene === "lobby" ? leaveTower : leaveToLobby}
              className="paper rounded-full px-4 py-2 font-serif text-lg font-bold"
              aria-label={scene === "lobby" ? "Interview Tower: leave the tower" : "Interview Tower: back to the lobby"}
            >
              Interview Tower
            </button>
          )}
          <span className="paper rounded-full px-3 py-1.5 text-sm text-[var(--ink-2)]" data-testid="online">
            {online > 0 ? `${online} ${online === 1 ? "person" : "people"} inside` : "Quiet right now"}
          </span>
          {progress && progress.streak.count > 0 && (
            <span className="paper rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--sun)]" data-testid="streak">
              {progress.streak.count}-day streak
            </span>
          )}
        </header>

        {scene === "outside" && (
          <div className="pointer-events-auto mt-auto flex flex-col gap-3 p-4 sm:max-w-md sm:p-8">
            <div className="paper rounded-3xl p-5 sm:p-6">
              <h1 className="font-serif text-3xl font-bold leading-tight sm:text-4xl">Walk in. Get asked. Find out where you would have slipped.</h1>
              <p className="mt-3 text-[var(--ink-2)]">Five floors of interview rooms for AI engineers. Every question comes with the confident wrong answer, so you can see the trap before you step in it. No login. Nothing to install.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={enter} className="rounded-full bg-[var(--sun)] px-6 py-3 text-lg font-semibold text-white shadow">
                  Enter the tower
                </button>
                <button onClick={() => openQuestion(today)} className="rounded-full border border-[var(--line)] bg-[var(--card)] px-5 py-3 font-semibold text-[var(--ink)]">
                  Today&apos;s question
                </button>
              </div>
            </div>
          </div>
        )}

        {scene === "lobby" && (
          <div className="pointer-events-auto mt-auto flex max-h-[46vh] flex-col gap-2 overflow-y-auto p-3 sm:mt-0 sm:max-h-none sm:w-[26rem] sm:p-4">
            <div className="paper rounded-2xl p-3 sm:p-4">
              <h2 className="font-serif text-xl font-bold">The lobby</h2>
              <p className="text-sm text-[var(--ink-2)]">Click a door, or pick a floor here.</p>
              <button onClick={() => openQuestion(today)} className="mt-2 w-full rounded-xl border border-[var(--sun-line)] bg-[var(--sun-soft)] px-3 py-2 text-left">
                <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--sun)]">Today&apos;s question</span>
                <span className="font-serif text-base text-[var(--ink)]">{today.title}</span>
              </button>
            </div>
            <ul className="flex flex-col gap-2" aria-label="Floors">
              {ROOMS.map((r) => {
                const qs = QUESTIONS.filter((q) => q.room === r.id);
                const tried = qs.filter((q) => done(q.id)).length;
                const inside = presence?.rooms[r.id] ?? 0;
                return (
                  <li key={r.id}>
                    <button onClick={() => pickRoom(r.id)} disabled={walkTo !== null} className="paper flex w-full items-center gap-3 rounded-2xl p-3 text-left disabled:opacity-60" data-room={r.id}>
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
              <InterviewPanel key={question.id} question={question} onResult={report} onExpression={setExpression} onNext={next} onLeave={leaveToLobby} />
            </div>
          </div>
        )}
      </div>

      <div aria-hidden className={clsx("pointer-events-none absolute inset-0 bg-[#f1e6d2] transition-opacity", fading ? "opacity-100" : "opacity-0")} style={{ transitionDuration: `${FADE_MS}ms` }} />
    </div>
  );
}
