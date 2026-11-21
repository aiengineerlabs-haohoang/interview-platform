import type { QuestionInput } from "../../types";

export const LANGUAGE_MODELS_MORE: QuestionInput[] = [
  {
    id: "under-trained-token-rows",
    room: "language-models",
    level: "senior",
    title: "The never-trained row",
    prompt:
      "Your 128K-vocabulary model emits bursts of garbage, always triggered by the same handful of rare strings. The tokenizer and the training corpus were built by different teams, months apart. What is the mechanism, and how do you get the full list of bad tokens before a customer finds them?",
    trap: {
      saying: "The vocabulary is too large, so rare tokens never get enough supervision. We will just shrink it in the next version.",
      whyWrong: "The rows are not under-supervised, they were never trained at all, and shrinking the vocabulary does nothing for the model you already shipped.",
      patterns: ["vocab(ulary)? (is )?too (large|big)", "shrink (the )?vocab", "cut (the )?vocab", "not enough supervision"],
    },
    points: [
      { id: "appearing", label: "A vocabulary row is only trained by appearing in the training data, not by existing in the table", weight: 3, patterns: ["never (got|received|seen)", "appear", "absent from (the )?(training|data)", "no gradient", "never trained", "untrained"] },
      { id: "decoupled", label: "The tokenizer is fit separately from training, so text it learned from may have been filtered out of the training mix", weight: 3, patterns: ["fit separately", "separately", "different (data|corpus|distribution|teams)", "filtered", "decoupl", "mismatch"] },
      { id: "sweep", label: "Sweep the whole vocabulary offline: tokenizer analysis, weight based indicators and prompting each candidate", weight: 3, patterns: ["sweep", "whole vocab", "entire vocab", "every (token|row)", "enumerate", "weight based", "indicators?", "prob(e|ing)", "prompt each"] },
      { id: "diff", label: "Diff the vocabulary against the post-filter training mix and treat rows with near zero counts as suspects", weight: 2, patterns: ["diff", "counts?", "compare (the )?vocab", "near zero", "zero (count|occurrence)", "suspects?"] },
      { id: "ship-list", label: "Ship the list with the model and regenerate it for every checkpoint", weight: 2, patterns: ["ship the list", "every checkpoint", "per checkpoint", "regenerat", "block ?list", "glitch tokens?", "under.?trained"] },
    ],
    mechanism:
      "A vocabulary row is trained by appearing in the data, not by existing. When the tokenizer is fit separately from the model, anything it learned from text that was later filtered out still owns a row in the embedding matrix and may never have received a gradient. A prompt can steer the model into that row, but it was never trained, so the output is initialisation plus drift and shows up as glitch or under-trained tokens. Find them by sweeping the whole vocabulary with weight based indicators plus a prompt probe, and by diffing the vocabulary against the post-filter training mix, then ship the list with each checkpoint.",
    clincher:
      "Those rows are not under-supervised, they are untrained: the tokenizer was fit on a corpus the training data no longer matches. I would sweep the whole vocabulary with weight based indicators plus a prompt probe and diff it against the post-filter mix, rather than wait for a customer to find the next one.",
  },
  {
    id: "adding-tokens-regression",
    room: "language-models",
    level: "senior",
    title: "Adding a token deletes a skill",
    prompt:
      "Your product has 400 new SKUs, each currently split into six or seven pieces by the tokenizer. A teammate wants to append 400 tokens, resize the embedding matrix and fine-tune for an epoch. Why can that make quality worse before it makes it better, and what would you do instead?",
    trap: {
      saying: "The new rows start random, the fine-tune trains them, and the sequences get shorter, so it is a free win.",
      whyWrong: "Those SKUs already tokenize into pieces the model understands. Appending a token swaps that working composition for a row with no training behind it.",
      patterns: ["rows? start random", "fine.?tune (will )?(trains?|fix)", "free win", "no downside", "just (add|append) (the )?tokens"],
    },
    points: [
      { id: "deletes", label: "Today the SKUs are made of pieces the model has seen in many other words, so adding a token deletes a representation that worked", weight: 3, patterns: ["already (tokeni[sz]e|split|work)", "pieces", "composition", "deletes?", "replaces?", "swap"] },
      { id: "random-row", label: "The new row is untrained on both the input embedding and the output projection", weight: 3, patterns: ["random", "untrained", "initiali[sz]", "output (projection|head|layer)", "both (sides|ends)"] },
      { id: "init-chance", label: "Naive initialisation heuristics can behave at chance level, so the gap only closes with substantial continued training", weight: 2, patterns: ["chance", "heuristic", "continued training", "billion", "lots of (data|training)"] },
      { id: "price-first", label: "Price the sequence length saving on real traffic first, and consider retrieval or prompting for product recognition", weight: 2, patterns: ["traffic", "sequence length", "price", "measure", "retrieval", "prompt"] },
      { id: "regression", label: "Keep a regression suite on text containing none of the new strings, because that is where damage lands", weight: 2, patterns: ["regression", "none of the", "unrelated text", "held.?out", "other (text|strings)"] },
    ],
    mechanism:
      "Those SKUs are not unsupported today: each is six or seven pieces the model has seen in many other words. Appending a token means any string containing the SKU stops producing those pieces and starts producing one randomly initialised row, on the input embedding and on the output projection, so you swap a working composition for an untrained vector. Initialisation heuristics for new embeddings can perform at chance level, and the fix is continued training on a large and varied mix, not one epoch of a catalogue. Price the sequence length saving on real traffic first, consider retrieval or prompting instead, and keep a regression suite on text that contains none of the new strings.",
    clincher:
      "Those SKUs already tokenize into pieces the model understands, so appending a token trades that for a row with no training behind it. I would price the sequence length saving first, and regression test on text containing none of the new strings.",
  },
  {
    id: "embedding-is-a-lookup",
    room: "language-models",
    level: "mid",
    title: "The one-hot equivalence",
    prompt:
      "A colleague says an embedding layer is just a multiplication of a one-hot vector by a weight matrix, so it does not matter whether you implement it that way or as an indexed lookup. Same parameters, same answer. Where are they wrong, and why does it matter at a 200K vocabulary?",
    trap: {
      saying: "It is a multiply by a one-hot vector, so it is the same thing as the lookup and the implementation makes no difference.",
      whyWrong: "The arithmetic is identical but the execution is not: the one-hot form materialises a vocabulary wide activation for every token and runs a dense matmul against the whole matrix.",
      patterns: ["same thing", "no difference", "(it|embedding) is just a (one hot )?multipl", "doesn.t matter (how|which)"],
    },
    points: [
      { id: "lookup", label: "An embedding layer is an indexed read of rows from one parameter matrix, a lookup table", weight: 3, patterns: ["lookup", "look up", "index(ed)?", "table", "read (of )?rows", "select(s|ing)? rows"] },
      { id: "onehot-cost", label: "The one-hot form builds an activation as wide as the vocabulary per token and multiplies it by the whole matrix", weight: 3, patterns: ["as wide as (the )?vocab", "vocab(ulary)? (size|wide|sized)", "materiali[sz]", "dense (matmul|matrix)", "whole matrix", "one entry per"] },
      { id: "memory", label: "What fails to fit is the activation, not the weights, so the model fits but the forward pass runs out of memory", weight: 2, patterns: ["memory", "oom", "out of memory", "does not fit", "doesn t fit", "activation"] },
      { id: "same-math", label: "The arithmetic is identical, so the difference is purely in what runs and what it costs", weight: 2, patterns: ["same (math|arithmetic|parameters|result|answer)", "identical", "equivalent"] },
      { id: "max-norm", label: "A lookup layer is not always read only: options like max norm renormalise rows in place during the forward pass", weight: 1, patterns: ["max.?norm", "in.?place", "modif(y|ies) the weight", "writes? to"] },
    ],
    mechanism:
      "An embedding layer is an indexed read of rows from one parameter matrix, a lookup table over a fixed dictionary. The one-hot formulation reaches the same rows with the same arithmetic, but it builds an activation as wide as the vocabulary for every token and runs a dense matmul against the whole matrix. At a 200K vocabulary and a large batch it is that activation, not the weights, that fails to fit, so the model loads and the forward pass runs out of memory. Indexing avoids this, and features such as max norm even make the forward pass write to the weights in place.",
    clincher:
      "An embedding layer is an indexed read from a parameter matrix. The one-hot matmul gives the same answer by building a vocabulary wide activation per token, so the difference is memory and compute, not the math.",
  },
  {
    id: "label-scoring-two-strings",
    room: "language-models",
    level: "senior",
    title: "Two strings, not two labels",
    prompt:
      "You classify reviews by scoring two continuations, 'this review is positive' and 'this review is negative', and taking the higher log-probability. It beats chance, but a large majority of inputs land in one class. Where is the bias coming from, and what do you do before touching the prompt wording?",
    trap: {
      saying: "The prompt is biased. Let me reword it or swap in label words that read more naturally.",
      whyWrong: "The bias sits in the scoring function, not the wording: summed log-probabilities depend on label length and on how likely the label tokens are with no review in front of them.",
      patterns: ["(the )?prompt (is|was) biased", "reword", "rephrase", "swap (in )?(the )?label words?", "better label words?"],
    },
    points: [
      { id: "strings", label: "You are comparing two strings, scored as sums of log-probabilities over whichever tokens the label occupies", weight: 3, patterns: ["two strings", "sum of (the )?log", "summ(ed|ing) log", "label tokens", "string"] },
      { id: "length", label: "Every term is negative, so a longer label is penalised by construction unless token counts are equal or you average per token", weight: 3, patterns: ["length", "token count", "number of tokens", "longer label", "per token", "average per", "normali[sz]"] },
      { id: "prior", label: "The label tokens have an unconditional prior with no review in front of them, which is baked into every prediction", weight: 3, patterns: ["prior", "unconditional", "null context", "no (review|context|input)", "base rate", "calibrat"] },
      { id: "prefix", label: "Hold the prefix identical so the context term cancels, and score only the label tokens", weight: 2, patterns: ["identical", "same prefix", "cancel", "only the label", "score only"] },
      { id: "rates", label: "Report per class rates instead of accuracy above chance, which hides the skew", weight: 1, patterns: ["per.?class", "class rates?", "confusion", "distribution of predictions", "skew"] },
    ],
    mechanism:
      "You are not comparing two labels, you are comparing two strings. The score is a sum of log-probabilities over the label tokens, and no term can be positive, so it carries the number of tokens in the label and how probable those tokens are with no review in front of them. Holding the prefix identical makes the context term cancel; unequal token counts penalise the longer label, so equalise them or average per token. Measure the unconditional preference by scoring the labels against a null context, and report per class rates before rewording anything.",
    clincher:
      "The bias is in the scoring function, not the prompt: I am summing log-probabilities over label strings with different token counts and different unconditional frequency. I would score only the label tokens, normalise per token, and measure the gap against a null context before rewriting a word.",
  },
  {
    id: "mle-family-floor",
    room: "language-models",
    level: "staff",
    title: "More data, same floor",
    prompt:
      "You trained a bigram language model by counting, and held-out loss stopped improving after two successive doublings of the corpus. A colleague wants to double it again because maximum likelihood converges to the true distribution with enough data. What is wrong with that reasoning, and what do you do instead?",
    trap: {
      saying: "Maximum likelihood recovers the true data distribution with enough data, so we just need a bigger corpus.",
      whyWrong: "Maximum likelihood converges to the closest member of the model family you chose, not to the data distribution, so more data cannot remove the family's approximation error.",
      patterns: ["recovers? the true (data )?distribution", "converges? to the (true|data) distribution", "enough data (will|would) (fix|solve)", "just need (more|a bigger) (data|corpus)"],
    },
    points: [
      { id: "closest", label: "Maximum likelihood converges to the best member of the chosen model family, not to the data distribution", weight: 3, patterns: ["closest (member|model)", "best (member|model) (in|of|within)", "within (the|a) (model )?family", "model family", "fixed family"] },
      { id: "two-errors", label: "There are two errors: estimation error from finite data shrinks with more data, approximation error from the family does not", weight: 3, patterns: ["estimation error", "approximation error", "two (errors|sources)", "misspecif", "shrinks? with"] },
      { id: "flat", label: "A flat held-out curve means you are on the family's floor, so change the model", weight: 3, patterns: ["floor", "flat", "plateau", "change the model", "richer model", "bigger model", "neural"] },
      { id: "context", label: "A bigram only sees one previous token and has no notion of word similarity, which is the real limit", weight: 2, patterns: ["one previous token", "previous token", "farther", "longer context", "similarity", "only sees"] },
      { id: "memorise", label: "Maximum likelihood maximises probability of the training set, which counting models memorise, so it does not guarantee generalisation", weight: 1, patterns: ["memori[sz]", "training set", "train (vs|versus|and) test", "generali[sz]"] },
    ],
    mechanism:
      "Maximum likelihood picks the parameters, inside one fixed model family, that give the training set the highest probability. With infinite data it converges to the closest member of that family, not to the data distribution. There are two separate errors: estimation error, which shrinks as data grows, and approximation error from the family restriction, which does not. A bigram conditions on one previous token and cannot see farther context or word similarity, so a flat held-out curve means you are on the family's floor and should change the model rather than the corpus size.",
    clincher:
      "Maximum likelihood converges to the closest member of the family I chose, not to the data. Estimation error shrinks with tokens but approximation error does not, so a flat curve after two corpus doublings says change the model.",
  },
  {
    id: "perplexity-floor-not-one",
    room: "language-models",
    level: "mid",
    title: "A perfect perplexity of one",
    prompt:
      "A teammate reports held-out perplexity of 1.03 on web text and says it is the best a language model can ever reach, so the model is nearly perfect. How do you respond, and what do you check before anyone celebrates?",
    trap: {
      saying: "The best perplexity a language model can reach is 1, so 1.03 means we are nearly perfect.",
      whyWrong: "One is the floor of the formula, reachable only if the text is deterministic. On real text the floor is the entropy of the text, so a value near 1 signals a bug or leakage.",
      patterns: ["best (possible )?perplexity (is|of) 1", "perplexity (of )?1 is (the )?(best|perfect|ideal)", "nearly perfect", "1\\.03.{0,20}(great|excellent|best)"],
    },
    points: [
      { id: "floor", label: "One is the floor of the formula, reached only when the model gives probability one to every token", weight: 3, patterns: ["floor", "probability (of )?1", "probability one", "certain", "deterministic", "e to the (power )?(of )?(0|zero)"] },
      { id: "entropy", label: "On real text the floor is the entropy of the text itself, which is above one", weight: 3, patterns: ["entropy", "irreducible", "inherent (uncertainty|randomness)", "above 1", "not a single fixed"] },
      { id: "leakage", label: "A value near one suggests test set leakage or contamination, and web crawl held out is a deduplication claim", weight: 3, patterns: ["leak", "contaminat", "dedup", "seen the (test )?(text|data|set)", "memori[sz]"] },
      { id: "denominator", label: "Check the denominator: re-averaging a mean loss over padding positions makes perplexity too low", weight: 2, patterns: ["denominator", "padding", "pad(ded)?", "averag(e|ed|ing) (twice|again)", "ignore.?index", "double"] },
      { id: "vocab", label: "Perplexity is only comparable across models sharing a vocabulary, so a tokenizer change moves it", weight: 1, patterns: ["same (vocab|tokeni[sz])", "tokeni[sz]er (change|swap)", "vocabulary", "not (portable|comparable)"] },
    ],
    mechanism:
      "Perplexity is the exponential of the mean negative log-likelihood, so a model that gives probability one to every token scores exactly one. That floor is reachable only if the text is deterministic; on real text the floor is the entropy of the text, which is above one. A held-out perplexity near one is therefore a bug report, not a result: first suspect leakage, because the language model must be built without knowledge of the test set and held out on a web crawl is a deduplication claim, then suspect the denominator, for example averaging a loss that already ignores padding over all positions again. Perplexity is also only comparable across models sharing a vocabulary.",
    clincher:
      "One is the floor of the formula, not a target: it needs probability one on every token, and on real text the floor is the entropy of the text. A held-out perplexity near one means leakage or a denominator bug.",
  },
  {
    id: "bpe-punctuation-variants",
    room: "language-models",
    level: "senior",
    title: "Four slots for one word",
    prompt:
      "You trained byte-level BPE at 50K and the merge list has separate tokens for dog, dog., dog! and dog?. Compression looks healthy. What is that costing you, and where would you put the fix?",
    trap: {
      saying: "Nothing. Compression is the objective, those variants are frequent, so they earned their slots.",
      whyWrong: "A healthy compression ratio is exactly what a greedy frequency heuristic produces while it wastes vocabulary slots on variants of one word.",
      patterns: ["nothing", "compression is the (objective|goal|metric)", "they earned (their|the) slots", "frequent so (they|it)"],
    },
    points: [
      { id: "greedy", label: "BPE greedily merges the most frequent adjacent pair, and frequency is local so it cannot see that the variants are one word", weight: 3, patterns: ["greedy", "most frequent", "frequency", "local"] },
      { id: "slots", label: "The cost is wasted vocabulary slots and model capacity, each variant carrying a fraction of the evidence for the word", weight: 3, patterns: ["slots?", "wast", "capacity", "fraction of (the )?evidence", "sub.?optimal", "dilut"] },
      { id: "metric", label: "Compression cannot see the waste, so measure slots rather than bytes per token", weight: 2, patterns: ["compression (ratio )?(cannot|can t|won t|doesn t|does not)", "wrong metric", "bytes per token", "measure (the )?slots", "count (the )?rows"] },
      { id: "pretokenizer", label: "Put the constraint in the pre-tokenizer: forbid merges across character categories, with an exception for spaces", weight: 3, patterns: ["pre.?tokeni[sz]", "character categor", "across categor", "forbid", "prevent", "restrict (what|the) merge", "exception for spaces?"] },
    ],
    mechanism:
      "BPE repeatedly merges the most frequent adjacent pair until it reaches the target size. Frequency is local, so nothing in the loop knows that dog., dog! and dog? are one word with punctuation attached; several rows go to a single lexeme, each carrying a fraction of the evidence, a sub-optimal allocation of limited vocabulary slots and model capacity, while bytes per token still improves so the compression ratio cannot see it. The fix belongs in the pre-tokenizer, which prevents merges across character categories with an exception for spaces, and you measure waste by counting rows that differ only by trailing punctuation.",
    clincher:
      "Compression tells me my merges are frequent, not that they are well spent. I would forbid merges across character categories in the pre-tokenizer, with an exception for spaces, before spending another vocabulary slot on punctuation variants.",
  },
  {
    id: "classifier-embedding-api",
    room: "language-models",
    level: "senior",
    title: "Great sits near excellent",
    prompt:
      "Your team trained word embeddings inside a sentiment classifier and noticed that great and excellent land close together. Someone wants to expose the space as a general semantic similarity API. What do you want to see first, and what does the training objective actually guarantee?",
    trap: {
      saying: "The space already encodes meaning, since similar words are neighbours. Put a cosine endpoint on it.",
      whyWrong: "One good pair is not a space. The objective only arranges whatever reduces the classifier's loss, so pairs the task never had to separate are unconstrained.",
      patterns: ["already encodes? meaning", "similar words are neighbou?rs", "put a cosine (endpoint|api)", "ship (it|the cosine)"],
    },
    points: [
      { id: "task-loss", label: "The geometry is organised by the loss it was trained on, here sentiment, so neighbours reflect that task and not meaning in general", weight: 3, patterns: ["loss", "objective", "task", "sentiment", "organi[sz]ed by"] },
      { id: "unconstrained", label: "Pairs the task never had to separate are unconstrained, so one remembered pair is selection, not evaluation", weight: 3, patterns: ["unconstrained", "never had to", "one pair", "cherry", "selection", "anecdot"] },
      { id: "benchmark", label: "Require a held-out similarity benchmark with a score before trusting it", weight: 3, patterns: ["benchmark", "held.?out", "eval(uation)? set", "similarity (set|score|dataset)", "correlation"] },
      { id: "operation", label: "Name the operation, for example cosine on unit normalised vectors, and do not assume adding vectors composes phrases", weight: 2, patterns: ["cosine", "unit.?norm", "normali[sz]", "adding vectors", "compos", "air canada", "phrase"] },
      { id: "stability", label: "The geometry can vary with the loss function and the learning algorithm, so there is no stability guarantee across reruns", weight: 1, patterns: ["rerun", "re.?train", "seed", "stabil", "vary", "varies"] },
    ],
    mechanism:
      "Gradients reach the embedding rows through one path, the sentiment head, so the space is organised by what separates those classes. Great sitting near excellent is that loss being minimised, not meaning being discovered, and any pair the task never had to separate is unconstrained. The objective guarantees the loss fell on that task and distribution; it does not guarantee a calibrated distance, stability across reruns, or composition, since the meaning of a phrase is not the sum of its word vectors. Before it becomes an API you want a held-out similarity benchmark with a score and a named operation such as cosine on unit normalised vectors.",
    clincher:
      "A classifier's embedding space is organised by the classifier's loss, so great and excellent being neighbours is evidence about sentiment, not meaning. Before it becomes an API I want a held-out similarity score and a named operation, and I would rule out adding vectors for phrases.",
  },
  {
    id: "padded-batch-eval-loss",
    room: "language-models",
    level: "mid",
    title: "Loss that moves with batching",
    prompt:
      "Your evaluation loss changes when you reshuffle the batches, although the model has not changed and the release is tomorrow. What are the likely causes in a variable-length sequence model, and what is the first check you run?",
    trap: {
      saying: "Small differences between batches are just noise from shuffling, so I would ignore it and average a few runs.",
      whyWrong: "An evaluation of a fixed model on fixed data should not depend on batch composition. If it does, padding or the loss denominator is leaking into the number.",
      patterns: ["just noise", "ignore it", "shuffl(e|ing) noise", "average (a few|several) runs", "normal variance"],
    },
    points: [
      { id: "padding", label: "Pad tokens contribute to the loss, so a sequence scores differently depending on how much padding it received", weight: 3, patterns: ["pad", "padding", "padded"] },
      { id: "ignore-index", label: "Make the loss ignore padding explicitly, for example by passing the pad id as the ignore index to cross entropy", weight: 3, patterns: ["ignore.?index", "mask", "ignore (the )?pad"] },
      { id: "denominator", label: "Check the denominator: divide by the count of real target tokens, not the padded shape, and normalise accumulated gradients by tokens", weight: 3, patterns: ["denominator", "real (target )?tokens", "non.?pad", "count of (real )?tokens", "token count", "padded shape"] },
      { id: "batch-size-one", label: "Re-run the identical eval at batch size one, sorted and shuffled, and require agreement before trusting any number", weight: 3, patterns: ["batch size (of )?(1|one)", "batch of (1|one)", "three batchings", "re.?run (the )?(same|identical)", "sorted"] },
      { id: "total-loss", label: "Aggregate total loss over total real tokens rather than averaging per batch means", weight: 1, patterns: ["total loss", "per.?batch means?", "mean of means", "total (real )?tokens"] },
    ],
    mechanism:
      "If a sequence receives four pad positions in one batch and two in another, any loss that counts padding varies purely with how the batch was assembled. The fix is to ignore padding explicitly, for example by passing the pad id as the ignore index, and to check the denominator: with a mean reduction over non-ignored targets it is already right, but a hand written reduction must divide by the count of real target tokens, not the padded shape, and accumulated gradients should be normalised by tokens. Then re-run the identical evaluation at batch size one, length sorted and shuffled, aggregating total loss over total real tokens; the three numbers must agree before any of them goes in a report.",
    clincher:
      "I would run the eval at batch size one first. If that number does not match the batched one, the figure is a padding or denominator artifact, not a model result.",
  },
];
