import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { questionById } from "@tower/shared";
import { InterviewPanel } from "@/components/InterviewPanel";

const q = questionById("prompt-cache-prefix")!;
const GOOD =
  "Prompt caching is a prefix match, so one changed token early invalidates everything after it. Keep the context append-only with the system prompt and tool definitions frozen at the front, and remember that summarising history rewrites the prefix. Breakpoints also expire with a TTL.";

function setup(props: Partial<React.ComponentProps<typeof InterviewPanel>> = {}) {
  const onResult = vi.fn(async () => null);
  const onExpression = vi.fn();
  const onNext = vi.fn();
  const onLeave = vi.fn();
  render(<InterviewPanel question={q} onResult={onResult} onExpression={onExpression} onNext={onNext} onLeave={onLeave} {...props} />);
  return { onResult, onExpression, onNext, onLeave, user: userEvent.setup() };
}

describe("InterviewPanel", () => {
  it("shows the interviewer's question and an empty answer box", () => {
    setup();
    expect(screen.getByText(/barely 1\.3x/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /your answer/i })).toHaveValue("");
  });

  it("will not submit until the answer has enough words to be judged", async () => {
    const { user } = setup();
    const submit = screen.getByRole("button", { name: /submit answer/i });
    expect(submit).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /your answer/i }), "prefix match");
    expect(submit).toBeDisabled();
    expect(screen.getByText(/more words/i)).toBeInTheDocument();
  });

  it("tells the interviewer to look thoughtful while the candidate types", async () => {
    const { user, onExpression } = setup();
    await user.type(screen.getByRole("textbox", { name: /your answer/i }), "hmm");
    expect(onExpression).toHaveBeenCalledWith("thinking");
  });

  it("grades a strong answer, reveals the trap and the senior answer, and reports the score once", async () => {
    const { user, onResult, onExpression } = setup();
    await user.click(screen.getByRole("textbox", { name: /your answer/i }));
    await user.paste(GOOD);
    await user.click(screen.getByRole("button", { name: /submit answer/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/strong hire/i);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ questionId: q.id, score: 100 }));
    expect(onExpression).toHaveBeenLastCalledWith("warm");
    expect(screen.getByText(/the trap/i)).toBeInTheDocument();
    expect(screen.getByText(q.trap.saying)).toBeInTheDocument();
    expect(screen.getByText(q.clincher)).toBeInTheDocument();
  });

  it("lets the candidate overrule a keyword miss and re-scores without reporting again", async () => {
    const { user, onResult } = setup();
    await user.click(screen.getByRole("textbox", { name: /your answer/i }));
    await user.paste("It is a prefix match and only the front of the context matters here, which is why ordering is so important for the whole thing.");
    await user.click(screen.getByRole("button", { name: /submit answer/i }));
    const list = await screen.findByRole("list", { name: /what a strong answer covers/i });
    const boxes = within(list).getAllByRole("checkbox");
    const unchecked = boxes.filter((b) => !(b as HTMLInputElement).checked);
    expect(unchecked.length).toBeGreaterThan(0);
    const before = screen.getByTestId("score").textContent;
    await user.click(unchecked[0]!);
    await waitFor(() => expect(screen.getByTestId("score").textContent).not.toBe(before));
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it("shows the answer without scoring when the candidate gives up, and records nothing", async () => {
    const { user, onResult } = setup();
    await user.click(screen.getByRole("button", { name: /show me the answer/i }));
    expect(screen.getByText(q.clincher)).toBeInTheDocument();
    expect(screen.queryByTestId("score")).not.toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();
  });

  it("offers the next question and the way out", async () => {
    const { user, onNext, onLeave } = setup();
    await user.click(screen.getByRole("button", { name: /show me the answer/i }));
    await user.click(screen.getByRole("button", { name: /next question/i }));
    expect(onNext).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /back to the lobby/i }));
    expect(onLeave).toHaveBeenCalled();
  });

  it("shows what other people scored once the server answers", async () => {
    const { user } = setup({ onResult: vi.fn(async () => ({ attempts: 12, avgScore: 58, beat: 75 })) });
    await user.click(screen.getByRole("textbox", { name: /your answer/i }));
    await user.paste(GOOD);
    await user.click(screen.getByRole("button", { name: /submit answer/i }));
    expect(await screen.findByText(/beat 75%/i)).toBeInTheDocument();
    expect(screen.getByText(/12 attempts so far/i)).toBeInTheDocument();
  });
});
