import type { Room } from "./types";

export const ROOMS: readonly Room[] = [
  { id: "llm-inference", floor: 1, name: "LLM Inference", tagline: "KV cache, batching, decoding. Where the GPU bill is decided.", color: "#d9583c" },
  { id: "agents", floor: 2, name: "Agent Engineering", tagline: "Loops, tools, context and the evals nobody trusts yet.", color: "#3b7dd8" },
  { id: "ml-fundamentals", floor: 3, name: "ML Fundamentals", tagline: "The basics, asked the way a principal engineer asks them.", color: "#2f7d4f" },
  { id: "language-models", floor: 4, name: "Language Models", tagline: "Tokenizers, softmax, perplexity and decoding.", color: "#8a5bd0" },
  { id: "reinforcement-learning", floor: 5, name: "Reinforcement Learning", tagline: "Rewards, baselines and the ways a policy cheats.", color: "#c9962b" },
];

export function roomById(id: string): Room | undefined {
  return ROOMS.find((r) => r.id === id);
}
