import type { QuestionInput } from "../../types";

/** More questions for this floor, converted from verified posts. See docs/CONTENT.md. */
export const ML_FUNDAMENTALS_MORE: QuestionInput[] = [
  {
    id: "brackets-cost-the-ordering",
    room: "ml-fundamentals",
    level: "mid",
    title: "The readable metric trap",
    prompt:
      "Stakeholders cannot read an RMSE, so a teammate turns your price regression into a five-bracket classifier and reports 78 percent accuracy. Everyone prefers it. What did that conversion cost you, and what would you do instead?",
    trap: {
      saying: "It is the same model underneath and accuracy is easier to communicate, so the bracket version is fine.",
      whyWrong: "Discretising into unordered classes throws away the ordering of the target, so a near miss and a disaster score the same. Readability is a reporting problem, not a reason to change the model.",
      patterns: ["same model underneath", "accuracy is easier", "easier to (communicate|explain|read)", "not much"],
    },
    points: [
      { id: "ordering", label: "Unordered classes drop the ordering: one bracket off and three brackets off are equally wrong", weight: 3, patterns: ["order", "one bracket off", "near miss", "equally wrong", "distance"] },
      { id: "free-tradeoff", label: "Nothing in the loss prefers near, so the model may trade near misses for far ones", weight: 2, patterns: ["prefers? near", "trade", "far (one|miss|error)", "no notion of"] },
      { id: "edges", label: "The bracket edges are a business decision hidden in preprocessing, and two close items straddling an edge land in different classes", weight: 2, patterns: ["edge", "boundar", "straddl", "cut ?off", "business decision"] },
      { id: "not-comparable", label: "Accuracy and RMSE are not comparable, so you cannot say whether the model improved", weight: 1, patterns: ["not comparable", "cannot compare", "can t compare", "re.?scor", "apples"] },
      { id: "fix-reporting", label: "Keep the continuous model and fix the reporting: error in dollars, error distribution, or an interval", weight: 3, patterns: ["median absolute", "in dollars", "interval", "band", "error distribution", "reporting", "report (the )?error"] },
      { id: "threshold-downstream", label: "If the decision is truly discrete, predict the number and threshold it downstream at edges the business owns", weight: 2, patterns: ["downstream", "threshold (it|the)", "config", "derive the bracket"] },
    ],
    mechanism:
      "Regression versus classification is a choice about the output type, and that choice is where the metric gets its notion of distance. A continuous target carries an ordering; once it is cut into unordered classes the ordering disappears from both the objective and the metric, so a prediction one bracket off scores the same as one three brackets off and nothing in the loss prefers near. The edges also become a business decision smuggled into preprocessing, and accuracy cannot be compared with an RMSE. The readability problem belongs in the reporting layer: error in the unit stakeholders think in, the error distribution, or an interval, with any bracket derived downstream from the predicted value.",
    clincher:
      "Discretising the target drops the ordering unless the loss puts it back, so a near miss and a disaster score the same. I would predict the number, threshold it downstream where the business owns the edges, and solve the communication problem in the reporting layer.",
  },
  {
    id: "label-space-breaks-accuracy",
    room: "ml-fundamentals",
    level: "senior",
    title: "Two percent over 180,000 classes",
    prompt:
      "You must predict which of 180,000 SKUs a customer buys next. A teammate puts a softmax over all 180,000 and reports 2 percent top-1 accuracy as the baseline. What is wrong with the metric, and what is wrong with the output layer?",
    trap: {
      saying: "Two percent sounds bad, but random is one in 180,000, so it is clearly learning; we just need a bigger network.",
      whyWrong: "That answers only half the question. With a huge label space top-1 is the wrong measurement, and a dense softmax over every item is a costly and rigid output layer regardless of network size.",
      patterns: ["bigger (network|model)", "clearly learning", "random(ly)? (is|guess)", "one in 180"],
    },
    points: [
      { id: "top1-weak", label: "Top-1 accuracy carries almost no information over a very large label space", weight: 3, patterns: ["top 1", "top1", "accuracy"] },
      { id: "recall-at-k", label: "Measure recall at the slate size you render plus a ranking metric that knows where the right item landed", weight: 3, patterns: ["recall at", "recall@", "ranking metric", "ndcg", "mrr", "slate", "top k"] },
      { id: "baseline", label: "Add a simple baseline such as most popular in category so the number means something", weight: 1, patterns: ["popular", "baseline", "popularity"] },
      { id: "softmax-cost", label: "A dense softmax over every SKU is a huge weight matrix paid on every pass, and most rows rarely get a gradient", weight: 2, patterns: ["weight matrix", "softmax", "rows", "expensive", "cost"] },
      { id: "retrieval", label: "Treat it as retrieval: embed context and item and use nearest neighbour over the catalogue", weight: 3, patterns: ["retriev", "embed", "nearest neighbou?r", "two tower", "ann"] },
      { id: "unseen-labels", label: "A classifier cannot predict a label that did not exist at fit time, so catalogue churn favours retrieval", weight: 2, patterns: ["new (sku|item|product)", "did not exist", "churn", "unseen", "cold start"] },
    ],
    mechanism:
      "The size of the label space changes what the metric means and what the output layer costs, and those are two separate bugs. Top-1 accuracy asks whether the single highest-scoring label was the realised one, which carries almost no information over 180,000 labels when the product shows a slate, so the metric should be recall at the slate size you render plus a ranking metric, segmented by head and tail and set against a popularity baseline. Separately, a dense softmax is a weight matrix with a row per SKU, paid on every forward pass, and a classifier cannot predict a label that did not exist at fit time. Framing it as retrieval over item embeddings addresses both, while a stable catalogue can still justify a plain classifier head.",
    clincher:
      "With 180,000 labels, top-1 is the wrong question and a dense softmax is the wrong layer. I would measure recall at the slate size we render against a popularity baseline, and treat the catalogue as something we retrieve from.",
  },
  {
    id: "clusters-need-an-outside-test",
    room: "ml-fundamentals",
    level: "senior",
    title: "The self-marking exam",
    prompt:
      "You cluster customer behaviour and get five clean clusters, and marketing starts naming them and building campaigns. Before that ships, what would it mean for those five clusters to be right, and how would you check?",
    trap: {
      saying: "They are tight and well separated, so they are real, and marketing can name them, which validates them.",
      whyWrong: "Tightness and separation are what the method produces, so they cannot validate it, and a nameable story is not evidence. With no output column, right has to be defined from a decision outside the clustering.",
      patterns: ["well separated", "tight (and|clusters)", "can name (them|the clusters)", "silhouette (is|score) (high|good)", "clean clusters.{0,20}(real|right)"],
    },
    points: [
      { id: "no-target", label: "With no output column nothing inside the clustering can be right or wrong; right must come from outside", weight: 3, patterns: ["no (output|label|target)", "from outside", "outside (test|the clustering)", "external", "cannot validate itself", "marks? itself"] },
      { id: "method-property", label: "The structure depends on the method: change the algorithm, distance or scaling and you get different, equally clean structure", weight: 2, patterns: ["algorithm", "distance", "scaling", "rescal", "different structure", "method"] },
      { id: "decision", label: "Does it change a decision: each segment needs a distinct action, and segments sharing an action collapse", weight: 3, patterns: ["decision", "action", "campaign", "same (action|campaign)", "change what"] },
      { id: "stability", label: "Check stability under reseeding, resampling, rescaling and next month's data", weight: 3, patterns: ["stab", "reseed", "resampl", "next month", "bootstrap", "different seed"] },
      { id: "held-out", label: "Check it predicts a held-out outcome the clustering never saw, such as churn or support contacts", weight: 3, patterns: ["held.?out", "never saw", "not given", "churn", "outcome", "downstream"] },
    ],
    mechanism:
      "Supervised learning has a target so wrong is defined for you; a clustering has inputs and no output column, so nothing in the data says what it was trying to predict. Interesting structure is a property of the method you chose rather than of the data, because changing the algorithm, the distance or the scaling gives different structure that looks just as clean. Compactness and separation are what the method produces, so asking the clustering whether its clusters are good is asking the exam to mark itself. Right has to be imported from outside: a different action per segment, stability under arbitrary choices such as seed, resampling and rescaling, and a held-out outcome the clustering was never given.",
    clincher:
      "Nothing inside a clustering can validate it, because the geometry it scores well on is the geometry it was built to produce. I would define right from outside: a different action per segment, stability under reseeding and rescaling, and a held-out outcome the clustering never saw.",
  },
  {
    id: "end-to-end-is-a-gradient-path",
    room: "ml-fundamentals",
    level: "staff",
    title: "The loss that trains nothing",
    prompt:
      "Your pipeline has a model that writes a search query, runs it against a search API, and writes an answer from the results. You put a loss on the final answer and train end to end, but the query model never changes and nothing errors. Explain what is going on and what you would do.",
    trap: {
      saying: "The loss is at the end, so it is end to end, and the framework handles gradients through sampling, so I would just tune the learning rate.",
      whyWrong: "End to end is about whether a gradient path reaches the weights, not where the loss sits. The gradient of a distribution exists, but there is no gradient through a drawn discrete token or an external API call.",
      patterns: ["loss is at the end", "framework (handles|takes care)", "learning rate", "sampling has a gradient"],
    },
    points: [
      { id: "gradient-path", label: "End to end is a property of the gradient path to the parameters, not of where the loss is computed", weight: 3, patterns: ["gradient path", "path (from|to)", "backprop", "reach(es)? the (weights|parameters)", "where the loss"] },
      { id: "sample-breaks", label: "Drawing a discrete token breaks the path: the distribution is differentiable, the drawn sample is not", weight: 3, patterns: ["discrete", "sampl", "drawn", "argmax", "token"] },
      { id: "silent", label: "It fails silently: connected parts keep learning so the loss falls and the run looks healthy", weight: 2, patterns: ["silent", "no error", "looks healthy", "loss (still )?(falls|decreas|goes down)", "never moves"] },
      { id: "options", label: "Options: make the step differentiable, estimate through it (such as straight through), or supervise it directly", weight: 3, patterns: ["straight through", "differentiable", "estimator", "supervis", "relax", "keep the distribution"] },
      { id: "not-rl", label: "Reinforcement learning is one option, not the definition of the problem, and it brings variance and tuning burden", weight: 2, patterns: ["reinforcement", "policy gradient", "not the only", "one option", "variance"] },
      { id: "api", label: "An external search API is not differentiable, so the live options are estimating on the reward or giving the query step its own labels", weight: 1, patterns: ["api", "external", "own (loss|label|objective|supervision)", "label which quer"] },
    ],
    mechanism:
      "A pipeline is end to end only if a gradient can reach the parameters you want to move, through a real derivative at every step or an estimator you put there on purpose. Where the model draws a discrete token to form a query, the distribution is a differentiable function of the parameters but the drawn token is not, so backpropagation has no path to the query model. Nothing errors and the loss still falls, because the connected parts keep learning. The remedies are to make the step differentiable, to estimate through it, or to supervise it directly, for example by labelling which queries retrieved the passage holding the answer. Reinforcement learning is one option among these and carries its own variance and tuning cost.",
    clincher:
      "End to end is about the gradient path, not where the loss sits. A sampled step breaks it, so I would either make the step differentiable, estimate through it, or give it its own supervision, since a loss at the end of a broken path trains nothing upstream and still looks fine.",
  },
  {
    id: "cosine-is-not-equivalence",
    room: "ml-fundamentals",
    level: "mid",
    title: "Wired merged with wireless",
    prompt:
      "Your dedup job merges two product listings when embedding cosine similarity clears 0.9. It just merged 'wired' with 'wireless'. A teammate wants to raise the threshold to 0.95. Why is that the wrong fix, and what do you do instead?",
    trap: {
      saying: "0.9 is too loose for product matching, so tighten the threshold and re-run.",
      whyWrong: "It treats a measurement error as a calibration problem. Cosine on off-the-shelf embeddings measures how similarly two phrases are used, not whether they mean the same, so no threshold separates opposites that appear in the same contexts.",
      patterns: ["too loose", "raise the threshold", "tighten (it|the threshold)", "0\\.95 (will|should|fixes)"],
    },
    points: [
      { id: "proximity", label: "Cosine measures distributional proximity, not semantic equivalence: words used in the same contexts sit close even when opposite", weight: 3, patterns: ["same (context|slot|categor)", "distributional", "used (alike|similarly)", "not (semantic )?equivalence", "proximity", "opposite"] },
      { id: "threshold-cant", label: "No threshold converts proximity into equivalence; a genuine pair can score lower than the pair you wanted split", weight: 3, patterns: ["no threshold", "threshold (cannot|can t|does not|won t)", "genuine pair", "lower than"] },
      { id: "fields", label: "Decide on fields: match identifiers first and require agreement on attributes that flip meaning", weight: 3, patterns: ["gtin", "mpn", "identifier", "attribute", "field", "hard block", "structured"] },
      { id: "recall", label: "Use embeddings for recall, proposing loose candidates, not for the final call", weight: 3, patterns: ["recall", "candidate", "nearest neighbou?r", "blocking", "propos"] },
      { id: "matcher", label: "Add a trained pairwise matcher and mine reversed merges as negatives", weight: 2, patterns: ["pairwise", "matcher", "classifier", "reversed", "human.{0,20}(review|label)", "negatives?"] },
    ],
    mechanism:
      "Off-the-shelf text embeddings put strings that occur in similar contexts near each other, so words that are interchangeable in context, even opposite ones like wired and wireless, end up close: cosine measures distributional proximity, not semantic equivalence. A higher threshold does not fix that, because a genuine duplicate whose titles differ in packaging text can score lower than the pair you wanted split. The robust design decides on fields rather than prose: identifier matches first, and agreement required on attributes that flip meaning such as connectivity or capacity. Embeddings then serve recall, proposing candidates loosely, and a trained pairwise matcher makes the call, with human-reversed merges mined as negatives.",
    clincher:
      "Cosine tells you whether two phrases are used alike, not whether they mean the same thing, and wired and wireless are supposed to be close. I would use the embedding for recall and decide on identifiers and the attributes that change meaning.",
  },
  {
    id: "verifier-filtered-loop",
    room: "ml-fundamentals",
    level: "staff",
    title: "The bootstrap with no brake",
    prompt:
      "A pipeline runs unattended: the model writes candidate labels, a validator keeps the ones it can confirm, and next week's model trains on those. It has not crashed. What do you check before you trust it, and what would you insist on before round one?",
    trap: {
      saying: "The validator filters out the bad labels, so every round is cleaner and the loop keeps improving on its own.",
      whyWrong: "The model gets better at whatever the validator can see, not at what is true. The validator's precision on model-written rows is unmeasured, the kept slice can narrow quietly, and the loop supplies no stopping condition of its own.",
      patterns: ["validator (filters|removes) (the )?bad", "keeps? improving", "improve(s)? on its own", "each round (is )?(cleaner|better)"],
    },
    points: [
      { id: "audit-validator", label: "Measure the validator on the generator's output: hand label kept and rejected rows and report precision and miss rate", weight: 3, patterns: ["audit", "hand.?label", "measure the (validator|filter)", "precision", "kept and rejected", "miss rate"] },
      { id: "checker-vs-heuristic", label: "Know whether you have a real checker or a heuristic; self training works where correctness is decidable", weight: 2, patterns: ["checker", "heuristic", "decidable", "ground truth", "verifiable", "can be checked"] },
      { id: "stop", label: "Fix the number of rounds and a stopping condition before round one, gated on a frozen held out set the loop never touched", weight: 3, patterns: ["stopping", "stop condition", "number of rounds", "frozen", "held.?out", "before round one"] },
      { id: "provenance", label: "Tag every row with its round and validator version so any round can be rolled back, keeping the human seed separate", weight: 2, patterns: ["provenance", "tag", "version", "roll ?back", "immutable", "seed"] },
      { id: "narrowing", label: "Track what survives the filter, not how much: the kept set can narrow to easy cases or one template while volume rises", weight: 3, patterns: ["distribution", "narrow", "easy (case|bucket)", "template", "diversity", "drift", "what survives"] },
    ],
    mechanism:
      "The failure mode of a generate, validate and retrain loop is not a crash but a model quietly getting better at whatever the validator cannot see. Every number in the loop is conditional on the filter being right, so audit it first on the generator's own output by hand labelling a sample of kept and rejected rows, and be clear whether it is a true checker or a heuristic. The loop supplies no brake, so write the stopping condition before round one: a fixed number of rounds, each gated on a frozen held-out set the loop never generated or trained on. Tag rows by round and validator version so a bad round can be rolled back, and monitor the distribution of what survives the filter, since it can narrow to easy cases while the volume chart rises.",
    clincher:
      "I would audit the validator first, because every other number in the loop is conditional on the filter being right, and I would write the stopping condition before round one, since the loop supplies none.",
  },
];
