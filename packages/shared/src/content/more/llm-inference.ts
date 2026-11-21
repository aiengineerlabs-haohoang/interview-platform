import type { QuestionInput } from "../../types";

export const LLM_INFERENCE_MORE: QuestionInput[] = [
  {
    id: "decode-latency-floor",
    room: "llm-inference",
    level: "senior",
    title: "Timing one token and multiplying",
    prompt:
      "What is the theoretical fastest an H100 can generate 100 tokens from an 8B-parameter Llama-style model, and why is the instinct to time one token and multiply by 100 wrong in both directions?",
    trap: {
      saying: "Easy: I will benchmark one token and scale it up by 100.",
      whyWrong:
        "A measured number reflects your software stack, not the hardware, so it is a ceiling on speed and never a floor. Scaling by 100 also assumes every token costs the same, which it does not.",
      patterns: ["benchmark (one|a single|1) token", "time (one|a single|1) token", "multiply (it )?by 100", "scale (it )?up"],
    },
    points: [
      { id: "ceiling", label: "A benchmark measures your stack, with launch overhead and unfused kernels, so it is a ceiling and not a floor", weight: 2, patterns: ["overhead", "unfused", "your stack", "ceiling", "kernel launch", "cuda graph"] },
      { id: "growing", label: "Decode is not constant cost: the KV cache grows each step, so later tokens attend over more context", weight: 2, patterns: ["kv cache", "grows", "more context", "not constant", "later tokens"] },
      { id: "membound", label: "Single-stream decode is memory-bandwidth bound, not compute bound", weight: 3, patterns: ["memory.?bound", "bandwidth", "not compute"] },
      { id: "formula", label: "The floor is derived: model bytes divided by HBM bandwidth, since every weight is streamed once per token", weight: 3, patterns: ["model bytes", "bytes (divided|over)", "weights? (once|every)", "stream", "hbm", "divided by"] },
      { id: "numbers", label: "About 16 GB of fp16 weights over roughly 3.3 TB/s gives on the order of 5 ms per token", weight: 1, patterns: ["16 ?gb", "3\\.3", "5 ?ms", "milliseconds"] },
    ],
    mechanism:
      "Timing a token in a framework measures your own stack, such as launch overhead, unfused kernels and no CUDA graphs, so it tells you how fast you are going and never how fast you could go. Multiplying by 100 is also too low, because decode is not constant cost: the KV cache grows every step, so late tokens attend over context the first token never saw. The real floor is computed. Single-stream decode is memory-bandwidth bound: to emit one token you must stream every weight out of HBM once, so the floor is model bytes divided by HBM bandwidth. For an 8B model in fp16 that is about 16 GB over roughly 3.3 TB/s, near 5 ms per token, with the FLOPs mostly idle.",
    clincher:
      "The floor is not something you benchmark, it is something you derive: for single-stream decode it is model bytes over HBM bandwidth, because you are memory-bound and not compute-bound. Everything above that number is overhead.",
  },
  {
    id: "ttft-vs-throughput",
    room: "llm-inference",
    level: "mid",
    title: "Two workloads, two bottlenecks",
    prompt:
      "You must serve one model for two use cases: a low-latency chatbot that needs a fast time to first token, and a high-throughput batch summarisation job. How do the two workloads stress the GPU differently, and what is the fundamental tradeoff you are managing?",
    trap: {
      saying: "Batch size 1 for the chatbot and a big batch size for the batch job. That is the whole answer.",
      whyWrong:
        "That is the what and not the why. It misses that inference is two phases with opposite bottlenecks, so the two workloads are limited by different resources.",
      patterns: ["batch size (of )?(1|one)", "small batch", "large batch size", "just (use )?(a )?(bigger|larger) batch"],
    },
    points: [
      { id: "phases", label: "LLM inference is two phases with opposite profiles: prefill and generation", weight: 3, patterns: ["prefill", "two (distinct )?phases", "generation phase", "decode"] },
      { id: "prefill-compute", label: "Prefill processes the whole prompt in parallel with big matrix multiplies, so it is compute bound", weight: 3, patterns: ["compute.?bound", "saturat", "tensor cores?", "matrix multipl", "parallel"] },
      { id: "ttft", label: "The chatbot's time to first token is dominated by prefill speed", weight: 2, patterns: ["ttft", "time to first token", "first token"] },
      { id: "decode-bw", label: "Generation emits one token at a time and rereads the KV cache from HBM, so it is memory-bandwidth bound", weight: 3, patterns: ["bandwidth", "memory.?bound", "kv cache", "hbm", "one token at a time"] },
      { id: "batch-tput", label: "For the batch job, keep memory bandwidth saturated, with larger batches, to maximise token throughput", weight: 1, patterns: ["larger batches", "bigger batches", "saturat", "token throughput", "throughput"] },
    ],
    mechanism:
      "LLM inference is not one workload but two phases with opposite performance profiles. Prefill processes the entire input prompt at once: it is a massively parallel pass full of large matrix multiplications, so it is compute-bound and can saturate the tensor cores, and the chatbot's time to first token is almost entirely set by prefill speed. Generation produces one token at a time and for each token must read the KV cache from high-bandwidth memory, so it is memory-bandwidth bound and the compute units sit idle waiting for data. The batch job's throughput is therefore a bandwidth problem and the chatbot's first-token latency is a compute problem.",
    clincher:
      "I am managing two bottlenecks: time to first token is dominated by compute-bound prefill, while batch throughput is limited by the memory-bandwidth-bound generation phase. So I optimise prefill for the chatbot and focus on saturating memory bandwidth, likely with larger batches, for the batch job.",
  },
  {
    id: "mha-vs-gqa-speed",
    room: "llm-inference",
    level: "senior",
    title: "Same FLOPs, different speed",
    prompt:
      "You are A/B testing two 70B models, one using multi-head attention and one using grouped-query attention. A colleague argues they will have the same inference speed because FLOPs and parameter counts are about identical. Is that assumption correct?",
    trap: {
      saying: "The FLOPs are similar, so any speed gap must come from the GQA kernels being slightly better fused or optimised.",
      whyWrong:
        "That reasons about training, where FLOPs rule. Autoregressive decoding is memory-bandwidth bound, and the difference is how many bytes of KV cache each step must read.",
      patterns: ["flops (are|is) (similar|the same|identical)", "kernel fusion", "slightly (more )?optimi[sz]ed", "same speed"],
    },
    points: [
      { id: "membound", label: "Decoding is memory-bandwidth bound, so FLOPs are not the right guide to speed", weight: 3, patterns: ["memory.?bound", "bandwidth", "flops (are )?(irrelevant|not)", "not compute"] },
      { id: "reads", label: "Every generated token reads the whole history of keys and values from HBM", weight: 2, patterns: ["every (single )?token", "entire history", "whole history", "hbm", "reads? the (entire |whole )?kv"] },
      { id: "mha", label: "Multi-head attention keeps a key and value head per query head, so its KV cache is large", weight: 2, patterns: ["mha", "multi head", "per query head", "head for every", "massive"] },
      { id: "gqa", label: "Grouped-query attention shares K/V heads across groups of query heads, shrinking the cache", weight: 3, patterns: ["gqa", "grouped query", "shares? k", "fewer k", "fewer kv", "shrink"] },
      { id: "cut", label: "A smaller cache means less data read per step, which is why GQA models decode faster", weight: 2, patterns: ["less data", "read pressure", "faster", "less memory traffic", "cuts?"] },
    ],
    mechanism:
      "The colleague is thinking about training, where you process large batches and FLOPs are king. Autoregressive decoding is the opposite: a matrix-vector style operation whose bottleneck is the memory bandwidth needed to read the KV cache. For every token generated, the GPU reads the entire history of keys and values from high-bandwidth memory. Multi-head attention has a key and value head for every query head, which makes that cache large. Grouped-query attention shares K/V heads across groups of query heads, for example many query heads but only a handful of K/V heads, which shrinks the cache and so the data read from HBM at every step. Equal FLOPs, very different bytes moved.",
    clincher:
      "No: FLOPs are irrelevant here, because decoding is bound by memory bandwidth and the KV cache. GQA is faster because it shares K/V heads, shrinking the cache and cutting HBM read pressure on every decode step.",
  },
  {
    id: "batching-vs-attention-bytes",
    room: "llm-inference",
    level: "staff",
    title: "Batching only rescues half the model",
    prompt:
      "Your model reaches healthy utilisation in training and in prefill, but GPUs sit nearly idle during token generation, and nothing is broken. What is structurally different about generation, and why will simply increasing the batch size not fix it?",
    trap: {
      saying: "Inference is memory-bound, so we increase the batch size to improve utilisation.",
      whyWrong:
        "That is only half right. Batching rescues the layers that share weights across sequences, but it cannot touch attention, where each sequence brings its own KV cache.",
      patterns: ["increase (the )?batch", "bigger batch", "larger batch", "raise (the )?batch", "just batch"],
    },
    points: [
      { id: "t1", label: "Generation is autoregressive: one token at a time, which loses the sequence-parallel axis training relies on", weight: 2, patterns: ["one token at a time", "autoregressive", "t ?= ?1", "single token", "loses? (the )?parallel"] },
      { id: "mlp", label: "In the MLP layers all sequences share the same weights, so loading them once amortises across the batch and batching helps", weight: 3, patterns: ["mlp", "same weights", "share (the )?weights", "amorti[sz]", "loaded? once"] },
      { id: "attn", label: "In attention every sequence has its own KV cache, so more sequences means proportionally more memory traffic", weight: 3, patterns: ["own kv", "unique kv", "nothing (is )?shared", "proportional", "each sequence"] },
      { id: "intensity", label: "Arithmetic intensity in attention stays low, so generation stays memory-bound however large the batch", weight: 2, patterns: ["arithmetic intensity", "memory.?bound", "stays? (low|pinned)", "no matter"] },
      { id: "tax", label: "Batching also raises per-step latency and grows total KV memory until you run out of memory", weight: 1, patterns: ["latency", "oom", "out of memory", "grows with"] },
      { id: "lever", label: "The real lever is shrinking the KV cache: GQA, latent attention, sliding window, paged allocation", weight: 2, patterns: ["gqa", "grouped", "mla", "latent", "sliding window", "paged", "shrink"] },
    ],
    mechanism:
      "Training sees the whole sequence at once. Generation is autoregressive with one token per step, so that parallel axis is gone. Split the model in two. In the MLP layers every sequence hits the same weights, so you load them once and amortise across the batch: arithmetic intensity rises with batch size. In attention, every sequence has its own KV cache and nothing is shared, so the batch dimension appears in both operands and adding sequences adds proportional memory traffic; intensity stays pinned near one. Batching also makes per-step latency worse and the KV cache grows with the batch until you run out of memory, long before throughput levels off.",
    clincher:
      "Batch size only rescues the MLP: attention's memory traffic scales with the batch, so generation stays memory-bound no matter what. The real lever is shrinking the KV cache with GQA, latent attention, sliding windows or paged allocation, because in inference bytes moved is your latency.",
  },
  {
    id: "flashattention-io-not-flops",
    room: "llm-inference",
    level: "staff",
    title: "The quadratic you can actually fix",
    prompt:
      "Your team needs a 10M-token context window and an engineer says it is impossible because standard attention is quadratic in compute. Why is that the wrong bottleneck to focus on, and how does FlashAttention solve the real problem?",
    trap: {
      saying: "The quadratic compute is the bottleneck, so FlashAttention must be a sparse or approximate attention that cuts the FLOPs.",
      whyWrong:
        "FlashAttention computes exact attention and does not change the quadratic compute. It attacks the quadratic memory traffic between slow GPU memory and on-chip memory.",
      patterns: ["sparse", "approximate", "cuts? the flops", "reduces? the (flops|compute)", "compute is the bottleneck"],
    },
    points: [
      { id: "iobound", label: "Standard attention is memory-bound: the problem is quadratic memory I/O, not the math", weight: 3, patterns: ["memory.?bound", "i/?o", "memory (access|traffic)", "not (the )?(math|flops|compute)", "starv"] },
      { id: "naive", label: "A naive implementation materialises the N by N matrix, writes it to slow HBM and reads it back for softmax and the value multiply", weight: 2, patterns: ["n ?(x|by|\\*) ?n", "materiali[sz]", "writes?", "reads? (it )?back", "hbm"] },
      { id: "tiling", label: "FlashAttention splits Q, K and V into tiles that fit in fast on-chip SRAM", weight: 3, patterns: ["tiling", "tiles?", "blocks?", "sram", "on chip"] },
      { id: "fusion", label: "It fuses the matmul, softmax and value multiply into one kernel so the big matrix never goes to HBM", weight: 3, patterns: ["fus(ed|ion)", "one kernel", "single kernel", "never writes?", "one pass"] },
      { id: "exact", label: "It is exact, using an online softmax; it does not change the compute, it removes the slow memory traffic", weight: 2, patterns: ["online softmax", "exact", "same (flops|compute)", "does not change", "doesn.?t change"] },
    ],
    mechanism:
      "Modern GPUs have scaled their arithmetic far faster than their ability to move data from global memory, so standard attention is memory-bound, not compute-bound. The naive implementation computes the N by N score matrix, writes the whole thing to slow HBM, reads it back for the softmax and reads it again to multiply by V: the quadratic cost is in memory accesses. FlashAttention does not change the quadratic compute. It splits Q, K and V into tiles that fit in fast on-chip SRAM and fuses the matmul, softmax and value multiply into a single kernel, using an online softmax so the large intermediate matrix is never written to HBM. It trades slow memory accesses for fast compute, which is what GPUs are good at.",
    clincher:
      "Standard attention is memory-bound, so the quadratic bottleneck is I/O and not FLOPs. FlashAttention keeps the work in fast SRAM using tiling, kernel fusion and an online softmax, so the huge attention matrix never touches HBM.",
  },
  {
    id: "best-of-n-ship-decision",
    room: "llm-inference",
    level: "senior",
    title: "Sixteen rollouts, twelve points",
    prompt:
      "Best-of-16 rollouts with a critic reranker moves your coding agent from 20% to 32% on a benchmark and your product manager wants it shipped. What do you tell them?",
    trap: {
      saying: "That is a 60% relative improvement, so let us ship it and just budget for the extra inference.",
      whyWrong:
        "A leaderboard number is not a product decision. The gain is logarithmic in compute, the critic caps it, and the real cost is worse than 16x.",
      patterns: ["relative improvement", "just budget", "ship it", "60%"],
    },
    points: [
      { id: "log", label: "Gains are log-linear: roughly a constant bump per doubling of rollouts, so each further point costs exponentially more", weight: 3, patterns: ["log", "per doubling", "each doubling", "exponential"] },
      { id: "critic", label: "The critic is the ceiling: separate coverage (did any rollout solve it) from selection (did the critic pick it)", weight: 3, patterns: ["coverage", "selection", "critic", "verifier", "ceiling", "pass@"] },
      { id: "tests", label: "If real unit tests exist, a deterministic verifier beats a learned critic", weight: 1, patterns: ["unit tests?", "deterministic", "real tests"] },
      { id: "cost", label: "The true cost is worse than 16x: rollouts diverge after the first step so prefix cache reuse collapses, and latency follows the slowest rollout", weight: 3, patterns: ["cache", "diverge", "slowest", "p99", "prefix"] },
      { id: "when", label: "It is only rational for high-value, asynchronous, cheaply verifiable, low-volume work, not interactive high-QPS products", weight: 2, patterns: ["high value", "high stakes", "offline", "async", "low volume", "batch", "never"] },
    ],
    mechanism:
      "The gain is log-linear, not linear: the 12 points are roughly a constant bump per doubling across 1, 2, 4, 8 and 16 rollouts, so the next 12 points would cost far more, paid exponentially for arithmetic returns. The critic is the ceiling, not the generator. Coverage, whether any of the 16 solved the task, is separate from selection, whether the critic picked that one, and the gap is pure verifier loss. The cost is also worse than 16x: agent rollouts diverge after the first step, so the shared prefix dies and KV cache reuse collapses, and wall-clock is set by the slowest trajectory. It is only rational for high-value, asynchronous, cheaply verifiable, low-volume work.",
    clincher:
      "Best-of-N buys leaderboard points at exponential cost with a verifier-shaped ceiling. It is an offline, high-stakes batch technique and not a product feature, and if I can write the unit test I do not need the critic at all.",
  },
  {
    id: "reasoning-budget-allocation",
    room: "llm-inference",
    level: "staff",
    title: "Spending thinking where it counts",
    prompt:
      "Your agent scores 12 points higher with reasoning effort set to high, but 40% of users abandon the session before it finishes. How do you decide where to spend that reasoning budget?",
    trap: {
      saying: "I would use a smaller model for easy tasks and route the hard ones to the big model.",
      whyWrong:
        "That is query-level routing. The question is about step-level allocation inside a single trajectory, where most steps are mechanical.",
      patterns: ["smaller model for (the )?easy", "route (the )?hard", "route (the )?(easy|queries)", "query.?level"],
    },
    points: [
      { id: "multiply", label: "Agent loops multiply latency: high effort is paid at every step, serially, across a trajectory of many steps", weight: 3, patterns: ["every step", "each step", "serial", "multipl", "80 steps"] },
      { id: "nocache", label: "Reasoning tokens do not amortise; prefix caching helps the history but not freshly generated thought", weight: 2, patterns: ["amorti[sz]", "prefix cach", "freshly generated", "not cached", "full price"] },
      { id: "mechanical", label: "Most steps are mechanical, determined by the last observation, so extra thinking buys nothing there", weight: 2, patterns: ["mechanical", "determined by", "nearly determined", "already decided", "read lines|run the test"] },
      { id: "criteria", label: "Allocate by irreversibility and branching factor", weight: 3, patterns: ["irreversib", "branching", "fan.?out", "side effect"] },
      { id: "runtime", label: "Make effort a runtime escalation signal, for example at planning, after failures or before irreversible actions, not a global config", weight: 3, patterns: ["escalat", "runtime", "after (a )?fail", "planning", "not a (global )?(config|setting)", "per step"] },
    ],
    mechanism:
      "Agent loops multiply latency rather than add it. A trajectory is many steps, so turning effort up globally pays the thinking tax at every step, serially, and reasoning tokens do not amortise: prefix caching saves the system prompt and observation history but nothing on freshly generated thought. Most steps, such as scrolling, reading a range of lines, running a test or grepping a symbol, are nearly determined by the last observation, so high effort buys nothing there. The gains cluster at a few decision points, which you pick by irreversibility (can the next step undo a wrong choice) and branching factor (how many plausible next actions). Effort becomes a runtime escalation signal at planning, after failed calls, before irreversible actions.",
    clincher:
      "Reasoning effort is not a model setting, it is a budget allocated across a trajectory. I spend it on irreversibility and branching factor, escalating at planning, after repeated failures and before side effects, and not uniformly across steps that the last observation already decided.",
  },
];
