import type { QuestionInput } from "../../types";

export const AGENTS_MORE: QuestionInput[] = [
  {
    id: "reflect-before-retry",
    room: "agents",
    level: "mid",
    title: "Confidently rewriting the same bug",
    prompt:
      "Your autonomous coding agent is stuck in a loop: it writes bad Python, reads the stack trace, and confidently rewrites almost exactly the same broken code. A teammate wants to swap the small model for a much larger one. How do you fix it?",
    trap: {
      saying: "The model's reasoning is failing, so I would swap in a frontier model to improve its zero-shot ability.",
      whyWrong: "The flaw is in the execution flow, not the model's intelligence. A bigger model inside the same loop just gives you a more expensive version of the same loop.",
      patterns: ["swap (the )?(underlying )?(llm|model)", "upgrade (the )?model", "(bigger|larger|better|frontier) model", "more (capable|powerful) model"],
    },
    points: [
      { id: "missing-layer", label: "The structural flaw is a missing step between observation and action, not model intelligence", weight: 3, patterns: ["between (the )?observation and (the )?action", "missing (step|layer)", "structural", "execution flow", "architecture", "not (the )?(model|intelligence)"] },
      { id: "pattern-match", label: "The model tends to continue from what is in its context, so it rephrases the code it just saw", weight: 2, patterns: ["autoregressive", "pattern match", "rephras", "most likely", "context window"] },
      { id: "reflect-diagnose", label: "Force an explicit reflect and diagnose step: what did I just try and why did it fail per the trace", weight: 3, patterns: ["reflect", "diagnos", "critique", "why it failed", "what (i|it) (just )?tried"] },
      { id: "plan", label: "Require a written plan of the specific change for the next attempt", weight: 2, patterns: ["plan", "next attempt", "specific change"] },
      { id: "fact-check", label: "Fact-check the plan against its own history to see whether it repeats the last action before touching the environment", weight: 3, patterns: ["fact check", "repeat(ing|s)? (the |its )?(last|previous)", "against (its|the) (own )?(memory|history)", "before (it )?(execut|run|interact)"] },
    ],
    mechanism:
      "A language model is an autoregressive pattern matcher, and when it reads an error log the most likely continuation is often the code it just saw, slightly rephrased. The missing piece is a layer between observation and action. Before the agent may execute anything, force a structured intermediate state: reflect on exactly what was tried, diagnose why it failed according to the line in the stack trace, plan the specific change for the next attempt, and fact-check that plan against its own history to make sure it does not repeat the last action. That breaks the loop without a bigger model.",
    clincher:
      "Upgrading the model treats the symptom. I would force the agent to reflect, diagnose and write a plan, then fact-check that plan against its own history before it touches the environment, which fixes the architecture.",
  },
  {
    id: "discovery-execution-handoff",
    room: "agents",
    level: "senior",
    title: "The librarian who must also operate",
    prompt:
      "A single ReAct coding agent both searches a huge monorepo and writes the patch. By the time it has found the right files, patch quality has collapsed. A teammate suggests a model with a million-token window. How do you restructure the agent loop?",
    trap: {
      saying: "Move to a model with a 1M token context window, or filter the search results more aggressively with RAG.",
      whyWrong: "More room does not remove the dead-end searches and failed tool calls that dilute attention. Even with a huge window, more noise in the prompt means worse reasoning on the final task.",
      patterns: ["1m (token )?(context|window)", "million (token )?(context|window)", "(bigger|larger|longer) (context )?window", "aggressively filter"],
    },
    points: [
      { id: "pollution", label: "Cause: context pollution, as search paths, dead ends and failed tool calls dilute attention", weight: 3, patterns: ["pollut", "dilut", "noise", "dead.?ends?", "irrelevant"] },
      { id: "split", label: "Break the monolithic loop into separate discovery and execution agents or stages", weight: 3, patterns: ["split", "decouple", "separate", "multi.?agent", "pipeline", "two (agents|stages)", "discovery"] },
      { id: "summary", label: "The discovery stage hands over only a clean, structured summary of what must change", weight: 3, patterns: ["summar", "structured", "synthesi[sz]", "distil", "high signal", "extracted"] },
      { id: "discard", label: "Throw away the messy trajectory so the execution agent starts from a fresh context", weight: 2, patterns: ["throw away", "discard", "drop", "scrub", "fresh", "empty context", "clean (context|slate)"] },
      { id: "hiding", label: "The principle is information hiding: isolate noisy reasoning instead of scaling the window", weight: 2, patterns: ["information hiding", "isolat", "hide"] },
    ],
    mechanism:
      "When one agent acts as both librarian and surgeon, its window fills with dead-end reasoning, failed tool calls and irrelevant snippets, and that noise dilutes attention even if the window is not full. A bigger window does not change that. Break the monolith into a discovery stage whose only job is to find the exact code and root cause, then take a structured summary of the result, discard its messy trajectory, and give only that summary to a fresh execution agent whose context holds just the state it needs to write the patch.",
    clincher:
      "I would split discovery from execution with information hiding: the discovery agent returns only a structured summary, I throw away its trajectory, and a fresh execution agent writes the patch from a clean context.",
  },
  {
    id: "green-test-illusion",
    room: "agents",
    level: "senior",
    title: "Every test is green, the page is broken",
    prompt:
      "Your coding agent fixes a front-end bug. Every unit test passes, yet the UI is still visibly broken. How should the agent verify its own fix, and do you actually need a multimodal model to do it?",
    trap: {
      saying: "Just give it a vision model and let it look at a screenshot.",
      whyWrong: "That is vague and often the wrong first move. The core problem is that unit tests cannot see what the user sees, and behaviour bugs can be checked deterministically without any vision.",
      patterns: ["vision model", "multimodal", "look at (a |the )?screenshot", "screenshots? (and|to) (check|verify)"],
    },
    points: [
      { id: "jsdom", label: "Unit tests in a simulated DOM do not render CSS or lay out the page, so they miss what a user sees", weight: 3, patterns: ["jsdom", "simulated dom", "does(n'?t| not) render", "layout", "css", "not what (the )?user sees"] },
      { id: "real-browser", label: "Close the loop in a real browser, with a scripted check such as Playwright", weight: 3, patterns: ["real browser", "playwright", "headless", "browser"] },
      { id: "fail-first", label: "Write a reproduction first that fails before the fix and passes after, then keep it as a regression test", weight: 3, patterns: ["fail first", "fail to pass", "fails before", "reproduc", "regression test"] },
      { id: "visible", label: "Assert that things are visible and clickable, not merely present in the DOM", weight: 2, patterns: ["visible", "visibility", "clickable", "hit.?test", "behind (a |the )?modal", "present in the dom"] },
      { id: "bug-class", label: "Use pixels only for visual bugs; a text-only model can drive behaviour fixes and a vision model acts as a verifier", weight: 2, patterns: ["depends on (the )?bug", "bug class", "visual bugs?", "oracle", "verif(ier|ication)", "text only"] },
    ],
    mechanism:
      "Unit tests that run in a simulated DOM check logic, not rendering: CSS and layout are not computed and there is no hit-testing, so a button can exist, pass every assertion and still sit hidden behind a modal. The agent should close the loop in a real browser. First write a scripted reproduction that fails before the fix and passes after, asserting that elements are visible and clickable rather than merely present, and leave it behind as a regression test. Behaviour bugs need only a text-only model plus that script; for genuinely visual bugs such as clipping or overlap, bring in pixels, for example a vision model as the verification oracle, accepting that it is slower and nondeterministic.",
    clincher:
      "Unit tests verify the code, not the screen. I make the agent reproduce the bug in a real browser first, with a script that fails before and passes after, and bring in pixels only for bugs that are actually visual.",
  },
  {
    id: "static-benchmark-gap",
    room: "agents",
    level: "senior",
    title: "95 percent on the benchmark, lost in production",
    prompt:
      "Your multimodal agent scores 95 percent on a static web-task benchmark but falls apart in a live desktop environment. Why does it fail, and how do you measure true reliability?",
    trap: {
      saying: "The live environment is just visual noise, so I would fine-tune the vision encoder on more screenshots from it.",
      whyWrong: "That treats a measurement problem as a perception problem. A static benchmark only scores the next action against one recorded path, so it says little about what happens once the agent makes a slightly off step.",
      patterns: ["fine.?tune (the )?(vision )?encoder", "more (os|screenshot|training) data", "visual noise", "different dom"],
    },
    points: [
      { id: "static", label: "A static benchmark checks the next action against a single golden recorded demonstration", weight: 3, patterns: ["static", "golden", "recorded", "single (demonstration|path|trajectory)", "next action", "pre.?recorded"] },
      { id: "imitation", label: "It rewards imitation of the happy path, not navigation", weight: 2, patterns: ["imitation", "happy path", "memori[sz]", "overfit"] },
      { id: "recovery", label: "One slightly wrong step puts the agent out of distribution with no error recovery, so errors cascade", weight: 3, patterns: ["out of distribution", "\\bood\\b", "cascad", "error recovery", "recover", "compound"] },
      { id: "valid-alt", label: "Static data penalises valid alternative solutions, producing false failures", weight: 1, patterns: ["alternative", "other valid", "false (negative|positive)", "equivalent"] },
      { id: "executable", label: "Evaluate in an interactive executable environment where the agent acts, gets feedback and can self-correct", weight: 3, patterns: ["executable", "interactive", "simulat", "sandbox", "live environment", "environment feedback", "self.?correct"] },
    ],
    mechanism:
      "A static benchmark asks whether the model can predict the next action given one pre-recorded golden demonstration. That rewards imitation of the happy path and penalises valid alternative solutions. Live environments are dynamic: a page loads slowly or an unexpected pop-up appears, and the first slightly suboptimal step puts the agent out of distribution. Having never been evaluated on recovery, it spirals into cascading errors. To measure reliability, move evaluation into an executable interactive environment where the agent can act, fail, receive feedback from the environment and try to self-correct over open-ended trajectories.",
    clincher:
      "Static benchmarks only measure imitation of golden paths. To measure real reliability I evaluate the agent inside an interactive, executable environment that tests whether it can recover from errors instead of letting them cascade.",
  },
  {
    id: "stochastic-tool-wrapper",
    room: "agents",
    level: "staff",
    title: "The tool that fails open",
    prompt:
      "Your agent calls a calculator and a Python sandbox. You wrap your in-house translation model as another tool behind the same retry-on-error and response cache. Complaints arrive that nobody can reproduce. What is different about this tool?",
    trap: {
      saying: "Nothing structural. A tool is an external program behind a signature, so the same wrapper is correct.",
      whyWrong: "Retry and cache are determinism assumptions. A model-backed tool is not deterministic, so the wrapper that was right for a calculator now hides variance and fails silently.",
      patterns: ["nothing (structural|different|changes)", "same wrapper", "a tool is (just )?an external program", "same (retry|cache|wrapper)"],
    },
    points: [
      { id: "determinism", label: "Retry and cache assume determinism, and a model-backed tool is not deterministic", weight: 3, patterns: ["determinis", "stochastic", "non.?determin", "sampl", "same (answer|output) twice"] },
      { id: "fails-open", label: "It fails open: a fluent wrong answer instead of an exception, so retry on error never fires", weight: 3, patterns: ["fails? open", "fluent", "no exception", "never fires", "silent(ly)?", "wrong answer"] },
      { id: "cache-pin", label: "The cache freezes one draw and hides variance, especially if the key omits model version and decoding settings", weight: 2, patterns: ["cache", "freez", "pin"] },
      { id: "version-log", label: "Version it like a model: log version and decoding settings per call so a complaint is reproducible", weight: 3, patterns: ["version", "log", "decoding settings", "reproduc", "temperature"] },
      { id: "agreement", label: "Replace retry with agreement over k samples, plus a deterministic validator where one exists", weight: 2, patterns: ["agreement", "majority", "consisten", "k samples", "validator", "round trip", "schema"] },
    ],
    mechanism:
      "Retry-on-error and caching encode a determinism assumption that a translation model breaks. A stochastic tool rarely throws; it returns a fluent wrong answer, so retry-on-error never fires, and retrying on anything is just a resample, so the second success is a different draw rather than a fix. A cache freezes one draw and hides the variance, silently pinning the answer if its key omits model version and decoding settings. Treat the tool as a versioned model: log version and decoding settings per call, replace retry with agreement over several samples, add a deterministic validator where one exists, and budget for it as a model call.",
    clincher:
      "A calculator returns the same answer twice and a translation model does not, so retry and cache encode an assumption that no longer holds. I would treat it as a versioned model, log decoding settings per call, swap retry for agreement over several samples, and keep a deterministic validator where one exists.",
  },
  {
    id: "three-stores-called-memory",
    room: "agents",
    level: "senior",
    title: "Three things teams call memory",
    prompt:
      "Product asks you to give your agent memory. One engineer says use a vector store of past conversations, another says fine-tune nightly on transcripts, a third says just use a bigger context window and paste the history in. How do you reason about what memory means here?",
    trap: {
      saying: "Memory is a vector store of past conversations. Embed the history and retrieve the nearest chunks.",
      whyWrong: "That is one implementation of one kind of memory, and retrieval is its easy half. An append-only store holds old and new facts side by side and similarity search cannot prefer the newer one.",
      patterns: ["memory is (just )?a vector (store|database|db)", "vector (store|database|db) of (past )?(conversations|history)", "embed (the |all )?(history|conversations)", "just (use|paste) (a )?(bigger|larger|longer)"],
    },
    points: [
      { id: "outside", label: "Memory is text held outside the model and read back into context selectively", weight: 2, patterns: ["outside (the )?(model|context)", "external", "selective", "read back", "retriev"] },
      { id: "kinds", label: "There are different stores doing different jobs: facts and preferences, lessons learned, reusable workflows", weight: 3, patterns: ["facts?", "preferences?", "lessons?", "workflows?", "procedural", "episodic", "different (stores|types|kinds)", "three"] },
      { id: "stale", label: "An append-only store keeps stale and conflicting facts, so it needs updating and forgetting, not just search", weight: 3, patterns: ["stale", "conflict", "append", "newer", "update", "outdated", "contradict"] },
      { id: "finetune", label: "Fine-tuning on transcripts cannot be corrected or deleted by a later complaint, whereas a text store can", weight: 3, patterns: ["fine.?tun", "delet", "correct", "unlearn", "weights"] },
      { id: "capacity", label: "A bigger window is capacity, not memory: it has no selection mechanism and costs more tokens", weight: 2, patterns: ["capacity", "selection", "cost", "tokens", "bigger window", "paste"] },
    ],
    mechanism:
      "Agent memory is text held outside the model and read back into context selectively, in stores that do different jobs: facts and preferences, lessons about what worked or failed, and reusable workflows. Which one you need depends on what the user repeats. A vector store is one implementation of one store, and an append-only version keeps both the old and new fact, so similarity search cannot prefer the newer. Fine-tuning on transcripts confuses the store with the substrate, since you cannot correct or delete a fact from a weight update. A bigger window is capacity, not memory: it has no selection mechanism and costs tokens on every call.",
    clincher:
      "Memory is external text read back selectively, in separate stores for facts, lessons and reusable workflows. Vector search, a fine-tune and a bigger window answer three different questions, so I pick by what the user repeats.",
  },
  {
    id: "feedback-that-localizes",
    room: "agents",
    level: "staff",
    title: "A score that points nowhere",
    prompt:
      "Your coding agent's compiler-feedback loop lifted its solve rate. A teammate ports the same loop to a report writer, with an LLM judge producing the feedback. Nothing moves. What is missing?",
    trap: {
      saying: "The judge needs a better rubric and a stronger model.",
      whyWrong: "That tunes the wrong knob. The compiler was not scoring the output, it was locating the error, and a judge that returns a number gives the refiner nothing to act on.",
      patterns: ["better rubric", "(stronger|bigger|better) (judge|model)", "improve (the )?(judge|rubric)", "tune (the )?judge"],
    },
    points: [
      { id: "locate", label: "A compiler locates the error and says where; a judge score points nowhere", weight: 3, patterns: ["locali[sz]", "locat", "pinpoint", "span", "points? (to|at|nowhere)", "where"] },
      { id: "extrinsic", label: "Extrinsic feedback (compiler, test run, retrieved document) differs from the model critiquing itself", weight: 3, patterns: ["extrinsic", "intrinsic", "external (signal|feedback|source|check)", "same model", "critiqu(e|ing) itself"] },
      { id: "new-info", label: "Good feedback carries information the generator lacks, so a second prompt to the same model adds little", weight: 2, patterns: ["new information", "information (the )?(generator|model) lacks", "cannot compute", "lacks"] },
      { id: "noise", label: "Noisy feedback leads the refiner to make spurious edits or regenerate everything", weight: 2, patterns: ["noisy", "noise", "spurious", "false positive", "regenerat"] },
      { id: "manufacture", label: "Manufacture deterministic checks for the report: resolve citations, check numbers against sources, validate schema", weight: 3, patterns: ["citation", "numbers?", "schema", "deterministic", "check (each|every|the)", "source table", "programmatic"] },
    ],
    mechanism:
      "The gain in the coding loop came from the type of feedback, not from a score. A compiler is an extrinsic source: it evaluates correctness, localises the error and gives semantic information about it, and a refiner can act on all three. An LLM judge returning a single number, noisy and with no span, leaves the refiner nothing to fix, so it regenerates the whole report and you have built a reranker with extra latency. Audit any feedback source for information the generator lacks, low noise and localisation. Then manufacture deterministic checks for the report: resolve each citation against its retrieved passage, check each claimed number against its source, validate required sections against a schema, and keep the judge only for what nothing else can check.",
    clincher:
      "A compiler is not a score, it is a located error. I would audit any feedback source for new information, low noise and localisation, and build deterministic checks for citations, numbers and schema, keeping the LLM judge only for what nothing else can verify.",
  },
];
