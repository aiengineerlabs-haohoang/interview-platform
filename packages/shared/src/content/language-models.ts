import type { QuestionInput } from "../types";

export const LANGUAGE_MODELS: QuestionInput[] = [
  {
    id: "tokenizer-serving-mismatch",
    room: "language-models",
    level: "senior",
    title: "The silent tokenizer swap",
    prompt:
      "After a routine redeploy, a fine-tuned model's quality drops noticeably but nothing errors, no alerts fire and the logs look normal. The only change was a dependency upgrade in the serving image. Where would you look first, and why does nothing crash?",
    trap: {
      saying: "A tokenizer is just text splitting, so a different one gives the same result.",
      whyWrong: "The model never sees text. It sees integer ids, and each id indexes a learned embedding. A different tokenizer produces different ids for the same text.",
      patterns: ["just (text )?split", "same result", "tokenizers? (are|is) interchangeable", "doesn.t matter"],
    },
    points: [
      { id: "ids", label: "The model consumes integer token ids, not text", weight: 3, patterns: ["\\bids?\\b", "integers?", "indices", "index"] },
      { id: "embedding", label: "Each id selects a learned embedding row, so wrong ids mean wrong vectors", weight: 3, patterns: ["embedding", "lookup", "learned"] },
      { id: "silent", label: "It is silent because every id is still a valid integer in range", weight: 2, patterns: ["valid", "in range", "no error", "silent", "does not crash", "doesn't crash", "won't crash"] },
      { id: "pin", label: "Pin the tokenizer with the model weights and version them together", weight: 3, patterns: ["pin", "version", "same artifact", "ship together", "checksum", "hash"] },
      { id: "test", label: "Test it: round-trip text, compare ids on a fixed set, check special tokens and the chat template", weight: 2, patterns: ["round.?trip", "golden", "fixed (set|sample)", "special tokens?", "chat template", "compare (the )?ids"] },
    ],
    mechanism:
      "The network consumes a sequence of integers that index rows of a learned embedding matrix. If the serving tokenizer has different merges, a different vocabulary order, different special tokens or a changed chat template, the same sentence becomes different ids and therefore different vectors, but every id is still a valid integer so no exception is raised and quality quietly drops. The tokenizer is part of the model: ship it pinned with the weights and test that a fixed set of strings yields identical ids.",
    clincher:
      "The tokenizer is part of the model, not a utility: I would diff token ids on a fixed set of strings between the old and new image, and pin the tokenizer and chat template alongside the weights.",
  },
  {
    id: "softmax-is-not-confidence",
    room: "language-models",
    level: "mid",
    title: "Ninety-nine percent sure and wrong",
    prompt:
      "A classifier built on a language model outputs 0.99 for its top class on text unlike anything it was trained on, and it is wrong. A stakeholder asks why a 99 percent confident model is not trustworthy. What do you tell them?",
    trap: {
      saying: "The softmax output is the model's probability that it is right, so 0.99 means it is 99 percent likely to be correct.",
      whyWrong: "Softmax only normalises scores to sum to one. It has no way to say 'none of the above' and nothing in training makes it calibrated.",
      patterns: ["probability (that )?(it|the model) is (right|correct)", "99.{0,15}(likely|sure|confident).{0,15}(correct|right)", "softmax (is|=) (the )?confidence"],
    },
    points: [
      { id: "sum", label: "Softmax forces the scores to sum to one, so some class always gets the mass", weight: 3, patterns: ["sum to (one|1)", "normali[sz]", "has to (go|add)", "forced", "always (picks|gets|a winner)"] },
      { id: "calibrated", label: "Raw softmax outputs are not calibrated probabilities of being correct", weight: 3, patterns: ["calibrat", "overconfident", "over.?confident"] },
      { id: "ood", label: "Out-of-distribution inputs can still produce a confident prediction", weight: 2, patterns: ["out.of.distribution", "\\bood\\b", "unseen", "never seen", "unlike"] },
      { id: "fix", label: "Measure and fix: reliability diagram or ECE, temperature scaling on held-out data", weight: 2, patterns: ["temperature scal", "reliability", "\\bece\\b", "expected calibration", "held.?out", "platt"] },
      { id: "abstain", label: "Add a way to abstain: a reject option, thresholds or a separate OOD detector", weight: 1, patterns: ["abstain", "reject option", "ood detect", "threshold", "none of the above"] },
    ],
    mechanism:
      "Softmax turns any vector of scores into numbers that sum to one, so the model must put its mass somewhere even for an input it has never seen. Training with cross-entropy does not guarantee the numbers match how often the model is right, and modern networks tend to be overconfident. To use a probability as confidence you have to measure calibration on held-out data with a reliability diagram, correct it, for example with temperature scaling, and give the system a way to abstain.",
    clincher:
      "Softmax is a normaliser, not a confidence: it must sum to one even for garbage inputs, so I measure calibration on held-out data, apply temperature scaling, and give the system an abstain option.",
  },
  {
    id: "perplexity-across-tokenizers",
    room: "language-models",
    level: "staff",
    title: "A lower perplexity that means nothing",
    prompt:
      "Model A uses a 32k-token vocabulary and reports perplexity 8. Model B uses a 128k-token vocabulary and reports perplexity 14 on the same test set. A teammate concludes A is much better. What is wrong with that conclusion and what would you compute instead?",
    trap: {
      saying: "Lower perplexity is better, so model A wins.",
      whyWrong: "Perplexity is an average over tokens. Different tokenizers cut the same text into different numbers of tokens, so the two numbers are not measuring the same thing.",
      patterns: ["lower perplexity (is|means) better", "a wins", "model a (is )?(better|wins)", "perplexity .{0,20}direct"],
    },
    points: [
      { id: "per-token", label: "Perplexity is per token, and the token count depends on the tokenizer", weight: 3, patterns: ["per.?token", "number of tokens", "token count", "different (token|vocab|tokeni[sz])", "average over tokens"] },
      { id: "total", label: "The total log-likelihood of the text is the comparable quantity", weight: 3, patterns: ["total (log.?)?(likelihood|loss|nll)", "same text", "whole (text|document|test)", "sum of"] },
      { id: "normalise", label: "Normalise per character or per byte, for example bits per byte", weight: 3, patterns: ["per (character|char|byte)", "bits per", "\\bbpb\\b", "\\bbpc\\b", "character level"] },
      { id: "fewer-tokens", label: "A larger vocabulary uses fewer tokens, each carrying more information, so per-token loss rises", weight: 2, patterns: ["fewer tokens", "more (information|bits)", "bigger vocab", "larger vocab", "each token (carries|covers|encodes)"] },
    ],
    mechanism:
      "Perplexity is the exponential of the average negative log-likelihood per token. A larger vocabulary splits the same text into fewer, longer tokens, each of which is harder to predict, so its per-token loss is higher even when the model is no worse at modelling the text. What two models can be compared on is the total negative log-likelihood of the same test text, which you normalise by characters or bytes, giving bits per character or bits per byte.",
    clincher:
      "Perplexity is per token, and the two models do not share tokens: I would compare total log-likelihood on the same text, normalised per byte, before concluding anything about A and B.",
  },
  {
    id: "greedy-vs-sampling",
    room: "language-models",
    level: "mid",
    title: "Why the same prompt gives different answers",
    prompt:
      "Two users send the identical prompt to your model and get different answers, and a third user complains that with temperature zero the model keeps repeating itself. Explain both behaviours and how you would set decoding for a chat product versus a data-extraction endpoint.",
    trap: {
      saying: "The highest-probability token at every step gives the best answer, so always take the argmax and randomness is just a bug.",
      whyWrong: "Greedy choice at each step does not find the most probable whole sequence, and it falls into repetitive loops. Sampling is a deliberate feature, not noise.",
      patterns: ["always (take|use|pick) (the )?(argmax|highest|most likely)", "randomness (is )?(a )?bug", "best answer.{0,20}argmax"],
    },
    points: [
      { id: "sampling", label: "The model outputs a distribution and the decoder samples from it, so answers vary", weight: 3, patterns: ["sampl", "distribution", "stochastic", "random"] },
      { id: "temperature", label: "Temperature and top-p or top-k reshape or truncate that distribution", weight: 2, patterns: ["temperature", "top.?p", "top.?k", "nucleus"] },
      { id: "greedy", label: "Greedy decoding can loop and is not the most probable whole sequence", weight: 3, patterns: ["greedy", "repet", "loop", "degenerat", "most probable sequence", "beam"] },
      { id: "task", label: "Match decoding to the task: low temperature for extraction, higher for chat or creativity", weight: 3, patterns: ["low(er)? temperature", "extraction", "deterministic", "structured", "creative", "per task", "depends on the task"] },
      { id: "determinism", label: "Even at temperature zero, batching and floating point can still change outputs", weight: 1, patterns: ["floating", "batch", "non.?determin", "gpu"] },
    ],
    mechanism:
      "A language model produces a probability distribution over the next token and the decoder chooses from it. Sampling with temperature and top-p keeps text varied; greedy argmax is deterministic but can lock into repetitive loops, and picking the best token at each step does not give the most probable sequence overall. For extraction and structured output use low temperature or constrained decoding; for chat allow some sampling. Even then, batching and floating-point effects can make outputs differ slightly.",
    clincher:
      "Variation comes from sampling a distribution on purpose; greedy can loop. I would run extraction at low temperature or constrained decoding and chat with moderate temperature and top-p.",
  },
];
