import type { QuestionInput } from "../types";

export const LLM_INFERENCE: QuestionInput[] = [
  {
    id: "prompt-cache-prefix",
    room: "llm-inference",
    level: "senior",
    title: "The cache that never hits",
    prompt:
      "You enabled prompt caching on a 100-step agent trajectory expecting a 5-10x cost drop. In production you are seeing barely 1.3x, and most per-step content is cache-missing. What is actually happening, and why does the order of your context decide whether caching works at all?",
    trap: {
      saying: "Caching must be broken, or the provider is not caching enough of my prompt.",
      whyWrong: "The provider is doing exactly what it is designed to do. The context was built in a way that cannot be cached.",
      patterns: ["provider (is )?(not|n't)", "cache (is |must be )?broken", "increase the cache"],
    },
    points: [
      { id: "prefix", label: "Caching is a prefix match: only the longest common prefix is reused", weight: 3, patterns: ["prefix", "common start"] },
      { id: "cascade", label: "One changed token early invalidates everything after it", weight: 2, patterns: ["invalidat", "cache miss", "everything (after|downstream)", "cascade"] },
      { id: "append", label: "Keep the trajectory append-only; mutate the front and you pay", weight: 3, patterns: ["append"] },
      { id: "stable", label: "Freeze the stable prefix: system prompt and tool definitions go first and never move", weight: 2, patterns: ["system prompt", "tool def", "freeze", "stable"] },
      { id: "condense", label: "Summarising or condensing history rewrites the prefix and defeats the cache", weight: 2, patterns: ["summari[sz]", "condens", "compact"] },
      { id: "ttl", label: "Cache breakpoints are limited and expire, so slow steps go cold", weight: 1, patterns: ["\\bttl\\b", "expire", "breakpoint"] },
    ],
    mechanism:
      "Prompt caching is a prefix match, not a diff. The KV cache reuses the longest common prefix of the context and nothing else, so the moment one token changes early in the sequence every token after it is a cache miss. Timestamps injected at the top, re-ordered tools, trimmed turns and a summariser that rewrites history all change the front. The summariser you added to save money is fighting the cache you added to save money.",
    clincher:
      "Caching is a prefix match, so I keep the context append-only: system prompt and tool definitions first and frozen, new content only at the end, and I accept an occasional hard reset instead of constantly rewriting history.",
  },
  {
    id: "kv-cache-memory",
    room: "llm-inference",
    level: "senior",
    title: "Out of memory, not out of compute",
    prompt:
      "Your long-context chat service runs out of GPU memory long before the GPUs run out of arithmetic throughput, and the batch size you can serve keeps shrinking as conversations get longer. Where is the memory going, and what would you change?",
    trap: {
      saying: "We need more GPUs, or a smaller model, because the weights are too big.",
      whyWrong: "The weights are a fixed cost. What grows with every conversation, and with every extra token of it, is the key-value cache.",
      patterns: ["more gpus?", "smaller model", "buy"],
    },
    points: [
      { id: "kv", label: "The KV cache holds keys and values for every past token, per layer", weight: 3, patterns: ["kv cache", "key value", "keys and values"] },
      { id: "linear", label: "It grows linearly with sequence length and with batch size", weight: 2, patterns: ["linear", "grows with (the )?(sequence|context|length)", "per token"] },
      { id: "bandwidth", label: "Decoding is memory-bandwidth bound: every step re-reads the cache", weight: 2, patterns: ["bandwidth", "memory bound", "memory-bound"] },
      { id: "gqa", label: "Shrink it at the source: grouped-query or multi-query attention, fewer KV heads", weight: 2, patterns: ["grouped.?query", "multi.?query", "\\bgqa\\b", "\\bmqa\\b", "kv heads"] },
      { id: "paged", label: "Stop wasting it: paged allocation of KV blocks instead of one contiguous slab per request", weight: 2, patterns: ["paged", "vllm", "fragment"] },
      { id: "quant", label: "Quantise or evict the cache for old tokens", weight: 1, patterns: ["quanti[sz]", "evict", "sliding window", "offload"] },
    ],
    mechanism:
      "Every generated token needs the keys and values of all previous tokens at every layer, so the KV cache grows linearly with sequence length and with the number of concurrent requests. At decode time each step streams that cache from memory to produce one token, which makes decoding bandwidth-bound rather than compute-bound. The levers are fewer KV heads (grouped-query attention), paged allocation so blocks are not reserved and wasted, and quantising or evicting old entries.",
    clincher:
      "The memory is the KV cache, which grows linearly with context and batch, so I cut it with grouped-query attention, paged KV allocation and a quantised cache rather than buying more GPUs.",
  },
  {
    id: "continuous-batching",
    room: "llm-inference",
    level: "mid",
    title: "Why the batch is never full",
    prompt:
      "You serve a chat model with static batching: collect eight requests, run them together, return all eight. GPU utilisation looks poor and short requests have terrible latency even at low load. Explain why, and what you would switch to.",
    trap: {
      saying: "Just raise the batch size. Bigger batches are always better for throughput and latency.",
      whyWrong: "Bigger batches do not fix the real problem: in a static batch every request waits for the longest generation in it.",
      patterns: ["bigger batch", "larger batch", "increase the batch", "raise the batch"],
    },
    points: [
      { id: "longest", label: "A static batch finishes only when its longest sequence finishes", weight: 3, patterns: ["longest", "slowest", "straggler"] },
      { id: "idle", label: "Finished sequences leave their slot idle, so the GPU does padding or nothing", weight: 2, patterns: ["idle", "padding", "wasted", "sit(s|ting)? empty", "slot"] },
      { id: "continuous", label: "Continuous (iteration-level) batching schedules per decode step", weight: 3, patterns: ["continuous", "iteration.?level", "in.?flight", "per (decode )?step", "every step"] },
      { id: "swap", label: "New requests join the moment another finishes; nobody waits for a whole batch", weight: 2, patterns: ["join", "swap", "slot in", "admit", "as soon as"] },
      { id: "prefill", label: "Prefill and decode behave differently, so schedulers chunk or separate them", weight: 1, patterns: ["prefill", "chunk"] },
    ],
    mechanism:
      "Generation lengths differ wildly. With static batching the whole batch is held until its longest sequence is done, so short requests wait and finished slots sit idle. Continuous batching, also called iteration-level scheduling, rebuilds the batch at every decode step: a finished sequence leaves immediately and a waiting request takes its slot. Prefill is compute-heavy and decode is bandwidth-heavy, so good schedulers chunk prefill to keep decode latency steady.",
    clincher:
      "Static batches wait for their longest sequence, so I use continuous batching: schedule every decode step, let finished requests leave and new ones join immediately, and chunk the prefill.",
  },
  {
    id: "speculative-decoding",
    room: "llm-inference",
    level: "staff",
    title: "Faster without being worse",
    prompt:
      "A teammate proposes speculative decoding and another objects that it is an approximation that will lower answer quality. Who is right, and what decides whether you actually get a speed-up?",
    trap: {
      saying: "It trades quality for speed, like quantisation: the draft model's mistakes leak into the output.",
      whyWrong: "With the standard accept-or-reject rule the output distribution is exactly the target model's. The draft only changes how many target passes you need.",
      patterns: ["trades? (quality|accuracy)", "approximat", "lower quality", "worse quality", "draft model.{0,20}mistakes"],
    },
    points: [
      { id: "draft", label: "A small draft model proposes several tokens cheaply", weight: 2, patterns: ["draft", "small(er)? model", "proposes?"] },
      { id: "verify", label: "The target model verifies all of them in one forward pass", weight: 3, patterns: ["verif", "single (forward )?pass", "one (forward )?pass", "in parallel"] },
      { id: "exact", label: "Accept or reject sampling keeps the output distribution exactly the target's", weight: 3, patterns: ["exact", "same distribution", "identical distribution", "lossless", "no quality", "unbiased", "preserv"] },
      { id: "accept", label: "The speed-up depends on the acceptance rate of the draft", weight: 3, patterns: ["accept"] },
      { id: "bandwidth", label: "It works because decoding is memory-bound, so extra tokens per pass are nearly free", weight: 1, patterns: ["memory.?bound", "bandwidth", "nearly free", "spare compute"] },
    ],
    mechanism:
      "A cheap draft model proposes a few tokens. The target model scores all of them in a single forward pass and each is accepted or rejected with a rule that provably leaves the output distribution equal to the target's own. Decoding is memory-bound, so checking several tokens in one pass costs little extra. The gain is therefore decided by how often the draft agrees with the target: a poorly matched draft is rejected constantly and you pay for the draft for nothing.",
    clincher:
      "Both are partly right, but quality is not at risk: verification with accept-or-reject sampling preserves the target distribution exactly, and the speed-up is decided entirely by the draft's acceptance rate.",
  },
];
