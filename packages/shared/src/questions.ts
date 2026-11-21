import { AGENTS } from "./content/agents";
import { LANGUAGE_MODELS } from "./content/language-models";
import { LLM_INFERENCE } from "./content/llm-inference";
import { ML_FUNDAMENTALS } from "./content/ml-fundamentals";
import { REINFORCEMENT_LEARNING } from "./content/reinforcement-learning";
import { AGENTS_MORE } from "./content/more/agents";
import { LANGUAGE_MODELS_MORE } from "./content/more/language-models";
import { LLM_INFERENCE_MORE } from "./content/more/llm-inference";
import { ML_FUNDAMENTALS_MORE } from "./content/more/ml-fundamentals";
import { REINFORCEMENT_LEARNING_MORE } from "./content/more/reinforcement-learning";
import { QuestionSchema, type Question } from "./types";

/** Parsed at load: a malformed question fails the build and the tests, not a visitor's session. */
export const QUESTIONS: readonly Question[] = [
  ...LLM_INFERENCE,
  ...LLM_INFERENCE_MORE,
  ...AGENTS,
  ...AGENTS_MORE,
  ...ML_FUNDAMENTALS,
  ...ML_FUNDAMENTALS_MORE,
  ...LANGUAGE_MODELS,
  ...LANGUAGE_MODELS_MORE,
  ...REINFORCEMENT_LEARNING,
  ...REINFORCEMENT_LEARNING_MORE,
].map((q) => QuestionSchema.parse(q));

export function questionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export function questionsInRoom(room: string): Question[] {
  return QUESTIONS.filter((q) => q.room === room);
}
