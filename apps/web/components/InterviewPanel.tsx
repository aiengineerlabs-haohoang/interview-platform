"use client";

import { MIN_WORDS, VERDICT_LABEL, expressionFor, grade, regrade, wordCount, type Expression, type Grade, type Question, type Verdict } from "@tower/shared";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AttemptResult } from "@/lib/api";

export interface ResultReport {
  questionId: string;
  score: number;
  seconds: number;
}

interface Props {
  question: Question;
  /** Called once per question, when the answer is first submitted. Resolves with what other people scored, or null offline. */
  onResult: (r: ResultReport) => Promise<AttemptResult | null>;
  onExpression: (e: Expression) => void;
  onNext: () => void;
  onLeave: () => void;
}

const LINES: Record<Verdict, string> = {
  "strong-hire": "That is the answer I was hoping for.",
  hire: "Solid. You have the core of it.",
  "lean-no": "You are circling it. Look at what is missing.",
  "no-hire": "Not yet. Let us look at what a strong answer says.",
};

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function InterviewPanel({ question, onResult, onExpression, onNext, onLeave }: Props) {
  const [answer, setAnswer] = useState("");
  const [base, setBase] = useState<Grade | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [gaveUp, setGaveUp] = useState(false);
  const [community, setCommunity] = useState<AttemptResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [listening, setListening] = useState(false);
  const startedAt = useRef(Date.now());
  const recogRef = useRef<{ stop(): void } | null>(null);
  const [canDictate, setCanDictate] = useState(false);

  const revealed = base !== null || gaveUp;
  const words = wordCount(answer);
  const ready = words >= MIN_WORDS;

  useEffect(() => setCanDictate(speechCtor() !== null), []);

  useEffect(() => {
    if (revealed) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [revealed]);

  const shown = useMemo(() => (base ? regrade(base, overrides) : null), [base, overrides]);

  function onType(value: string) {
    setAnswer(value);
    onExpression(value.trim() === "" ? "neutral" : "thinking");
  }

  async function submit() {
    if (!ready) return;
    const g = grade(question, answer);
    const seconds = Math.min(3600, Math.floor((Date.now() - startedAt.current) / 1000));
    setBase(g);
    onExpression(expressionFor(g.verdict));
    setCommunity(await onResult({ questionId: question.id, score: g.score, seconds }));
  }

  function giveUp() {
    setGaveUp(true);
    onExpression("neutral");
  }

  function dictate() {
    const Ctor = speechCtor();
    if (!Ctor) return;
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const text = last?.[0]?.transcript;
      if (text && last?.isFinal) setAnswer((a) => (a ? `${a} ${text.trim()}` : text.trim()));
    };
    r.onend = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  }

  const left = question.seconds - elapsed;
  const clock = `${Math.floor(Math.abs(left) / 60)}:${String(Math.abs(left) % 60).padStart(2, "0")}`;

  return (
    <section aria-label="Interview" className="flex flex-col gap-4">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
          {question.level} · {question.title}
        </p>
        <p className="mt-2 font-serif text-lg leading-snug text-[var(--ink)]">{question.prompt}</p>
      </div>

      {!revealed && (
        <div className="flex flex-col gap-3">
          <label htmlFor="answer" className="sr-only">
            Your answer
          </label>
          <textarea
            id="answer"
            aria-label="Your answer"
            value={answer}
            onChange={(e) => onType(e.target.value)}
            rows={7}
            placeholder="Answer out loud in your head first, then write it the way you would say it to the panel."
            className="w-full resize-y rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 text-base leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--sun)] focus:ring-2 focus:ring-[var(--sun-line)]"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--ink-2)]">
            <span className={clsx("tabular-nums", left < 0 && "text-[var(--sun)]")} aria-label="Time">
              {left < 0 ? `+${clock}` : clock}
            </span>
            <span aria-hidden>·</span>
            <span>
              {words} {words === 1 ? "word" : "words"}
              {!ready && words > 0 ? ` · ${MIN_WORDS - words} more words to submit` : ""}
            </span>
            {canDictate && (
              <button type="button" onClick={dictate} className="ml-auto rounded-full border border-[var(--line)] px-3 py-1 hover:bg-[var(--tint)]">
                {listening ? "Stop dictating" : "Dictate"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!ready}
              onClick={submit}
              className="rounded-full bg-[var(--sun)] px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Submit answer
            </button>
            <button type="button" onClick={giveUp} className="rounded-full border border-[var(--line)] px-5 py-2.5 text-[var(--ink-2)] hover:bg-[var(--tint)]">
              Show me the answer
            </button>
            <button type="button" onClick={onLeave} className="ml-auto px-3 py-2.5 text-sm text-[var(--ink-3)] underline-offset-2 hover:underline">
              Back to the lobby
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div className="flex flex-col gap-4">
          {shown && (
            <div role="status" className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-3)]">{VERDICT_LABEL[shown.verdict]}</p>
              <p className="mt-1 font-serif text-xl text-[var(--ink)]">{shown.trapped ? "That is the answer I was warned about." : LINES[shown.verdict]}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-[var(--sun)]">
                <span data-testid="score">{shown.score}</span>
                <span className="text-base font-medium text-[var(--ink-3)]"> / 100</span>
              </p>
              {community && community.attempts > 1 && (
                <p className="mt-1 text-sm text-[var(--ink-2)]">
                  You beat {community.beat}% of the {community.attempts - 1} other {community.attempts - 1 === 1 ? "attempt" : "attempts"}. {community.attempts} attempts so far, average {community.avgScore}.
                </p>
              )}
              {community && community.attempts === 1 && <p className="mt-1 text-sm text-[var(--ink-2)]">You are the first to try this question.</p>}
            </div>
          )}

          {shown && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--ink)]">What a strong answer covers</h3>
              <p className="text-xs text-[var(--ink-3)]">Keyword matching is a blunt tool. Tick or untick anything it got wrong.</p>
              <ul aria-label="What a strong answer covers" className="mt-2 flex flex-col gap-1.5">
                {shown.points.map((p) => (
                  <li key={p.id}>
                    <label className={clsx("flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm", p.hit ? "border-[var(--good)] bg-[var(--good-soft)]" : "border-[var(--line)] bg-[var(--card)]")}>
                      <input
                        type="checkbox"
                        checked={p.hit}
                        onChange={(e) => setOverrides((o) => ({ ...o, [p.id]: e.target.checked }))}
                        className="mt-1 size-4 accent-[var(--good)]"
                      />
                      <span className="text-[var(--ink)]">{p.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-[var(--sun-line)] bg-[var(--sun-soft)] p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--sun)]">The trap</h3>
            <p className="mt-1 italic text-[var(--ink)]">{question.trap.saying}</p>
            <p className="mt-2 text-sm text-[var(--ink-2)]">{question.trap.whyWrong}</p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-3)]">The mechanism</h3>
            <p className="mt-1 text-[var(--ink)]">{question.mechanism}</p>
          </div>

          <div className="rounded-2xl border border-[var(--good)] bg-[var(--good-soft)] p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--good)]">The answer that gets you hired</h3>
            <p className="mt-1 font-serif text-lg text-[var(--ink)]">{question.clincher}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onNext} className="rounded-full bg-[var(--sun)] px-5 py-2.5 font-semibold text-white">
              Next question
            </button>
            <button type="button" onClick={onLeave} className="rounded-full border border-[var(--line)] px-5 py-2.5 text-[var(--ink-2)] hover:bg-[var(--tint)]">
              Back to the lobby
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
