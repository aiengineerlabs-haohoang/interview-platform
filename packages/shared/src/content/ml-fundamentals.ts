import type { QuestionInput } from "../types";

export const ML_FUNDAMENTALS: QuestionInput[] = [
  {
    id: "unsupervised-is-an-objective",
    room: "ml-fundamentals",
    level: "mid",
    title: "Unlabelled is not unsupervised",
    prompt:
      "A colleague says the events table has no label column, so this is an unsupervised problem and we should cluster it. Define unsupervised learning precisely and tell me whether they are right.",
    trap: {
      saying: "Nothing in the table is labelled, so it is an unsupervised problem.",
      whyWrong: "That confuses 'we have not got labels' with 'no label exists'. Unsupervised describes the objective, not the state of your data.",
      patterns: ["no labels?,? (so|therefore)", "unlabell?ed (data )?(means|is) unsupervised", "nothing is labell?ed"],
    },
    points: [
      { id: "objective", label: "Unsupervised describes the objective: a loss that never reads an output column", weight: 3, patterns: ["objective", "loss"] },
      { id: "not-dataset", label: "It is not a property of the dataset: labelled data can be trained on unsupervised", weight: 3, patterns: ["not a property", "not (about )?the (data|dataset)", "labell?ed data.{0,40}unsupervised", "regardless of (the )?(data|labels)"] },
      { id: "hidden-label", label: "A label is often one join away: a click, a return, a cancellation", weight: 2, patterns: ["join", "click", "return", "cancel", "renew", "hiding", "can be (built|assembled|derived)", "construct"] },
      { id: "methods", label: "Supervised, unsupervised and RL name methods, not kinds of problem or goal", weight: 2, patterns: ["method", "not (a )?kinds? of problem", "end goal", "decision"] },
      { id: "eval", label: "Sparse labels are often enough to evaluate even if too few to train", weight: 1, patterns: ["evaluat", "check against", "validate", "held.?out"] },
    ],
    mechanism:
      "Whether a dataset has labels and whether an objective reads them are two independent facts, and the word unsupervised describes only the second. A model trained with a loss that never touches an output column is unsupervised even if the source data is labelled. In practice the supposedly missing label is frequently one join away, such as a click, a return or a cancellation, and even a small labelled slice can be used to evaluate a model it is too small to train.",
    clincher:
      "Unsupervised describes the objective, not the dataset: the loss reads no output column. So 'we have no labels' is a statement about our pipeline, and I would first check whether a label is one join away.",
  },
  {
    id: "data-leakage",
    room: "ml-fundamentals",
    level: "senior",
    title: "Perfect offline, useless in production",
    prompt:
      "Your churn model scores a validation AUC near 0.98 offline. In production it is barely better than a coin flip. Nothing is broken in the serving code. Walk me through what you suspect and how you would find it.",
    trap: {
      saying: "It is overfitting. Add regularisation and dropout and retrain.",
      whyWrong: "Overfitting hurts validation too. A model that is excellent on held-out data and bad in production is seeing information offline that it will never have at prediction time.",
      patterns: ["overfit", "regulari[sz]ation", "dropout"],
    },
    points: [
      { id: "leak", label: "Data leakage: a feature or row carries information from the future or the label", weight: 3, patterns: ["leak", "future", "target", "label information"] },
      { id: "time", label: "Split by time, not randomly, whenever the model predicts forward", weight: 3, patterns: ["time.?based", "split by time", "temporal", "chronolog", "out.of.time", "random split"] },
      { id: "preprocess", label: "Fit scalers, encoders and imputers on the training fold only", weight: 2, patterns: ["fit (on )?(the )?train", "training fold", "pipeline", "scaler", "preprocess", "normali[sz]"] },
      { id: "audit", label: "Audit features: anything unavailable at prediction time, or suspiciously predictive, is a suspect", weight: 2, patterns: ["audit", "feature importance", "too good", "suspicious", "available at (prediction|inference|serving)", "point in time", "point.in.time"] },
      { id: "duplicates", label: "Check for the same entity or duplicates across train and validation", weight: 1, patterns: ["duplicate", "same (user|customer|entity)", "group"] },
    ],
    mechanism:
      "Overfitting shows up as a gap between training and validation, so a model that is superb on validation and poor in production has a different problem: the validation set is not a faithful rehearsal of production. Usual causes are features that encode the outcome or are only known after it, random splits of time-ordered data, preprocessing fitted on all rows before splitting, and the same customer on both sides of the split. The fix is a time-based split, pipelines that fit on the training fold only, and a point-in-time audit of every feature.",
    clincher:
      "A near-perfect offline score that collapses in production is a leakage smell, not overfitting: I would split by time, refit preprocessing inside the training fold, and audit every feature for availability at prediction time.",
  },
  {
    id: "imbalance-and-metrics",
    room: "ml-fundamentals",
    level: "mid",
    title: "The 99 percent accurate fraud model",
    prompt:
      "Fraud is one transaction in a hundred. Your model reports 99 percent accuracy and the product manager is delighted. What do you say, and what do you report instead?",
    trap: {
      saying: "99 percent is excellent, so ship it.",
      whyWrong: "A model that predicts 'not fraud' every time is 99 percent accurate and catches nothing. Accuracy hides exactly the class you care about.",
      patterns: ["99.{0,20}(excellent|great|good)", "ship it", "high accuracy"],
    },
    points: [
      { id: "baseline", label: "Predicting the majority class every time already scores 99 percent", weight: 3, patterns: ["majority", "always (predict|say)", "every time", "baseline", "trivial", "all negative", "never fraud"] },
      { id: "pr", label: "Report precision and recall, or PR-AUC, for the rare class", weight: 3, patterns: ["precision", "recall", "pr.?auc", "average precision", "f1"] },
      { id: "threshold", label: "Choose the threshold from the cost of a miss versus a false alarm", weight: 3, patterns: ["threshold", "cost", "operating point", "false (alarm|positive)", "review (capacity|queue)"] },
      { id: "calibration", label: "Check calibration if the scores feed decisions or expected-value maths", weight: 1, patterns: ["calibrat"] },
      { id: "resample", label: "Class weights or resampling can help training but do not fix the evaluation", weight: 1, patterns: ["class weight", "resampl", "oversampl", "undersampl", "smote", "weighted loss"] },
    ],
    mechanism:
      "Accuracy is dominated by the majority class, so with one positive in a hundred a constant 'not fraud' answer scores 99 percent while detecting nothing. The numbers that describe the rare class are precision and recall, or the area under the precision-recall curve, which unlike ROC-AUC does not flatter you when negatives are plentiful. The real decision is a threshold chosen from the cost of a missed fraud against the cost of a false alarm and how many cases analysts can review.",
    clincher:
      "I would not ship on accuracy: a model that always says 'not fraud' also scores 99 percent. I report precision and recall at a threshold chosen from the cost of misses and false alarms.",
  },
  {
    id: "learning-curves",
    room: "ml-fundamentals",
    level: "senior",
    title: "More data did not help",
    prompt:
      "Training error is very low and validation error is much higher. Your manager asks whether to collect more data or to make the model bigger. How do you decide, and what would you look at before spending anything?",
    trap: {
      saying: "Make the model bigger and train for longer until the validation error comes down.",
      whyWrong: "A large gap with low training error is a variance problem. More capacity makes it worse, because the model already fits the training set too well.",
      patterns: ["bigger model", "larger model", "more layers", "train (for )?longer", "more parameters"],
    },
    points: [
      { id: "variance", label: "Low training error with a high validation error is high variance (a generalisation gap)", weight: 3, patterns: ["variance", "gap", "overfit", "generali[sz]"] },
      { id: "curves", label: "Plot learning curves: error against training-set size shows which fix will pay", weight: 3, patterns: ["learning curve"] },
      { id: "converge", label: "If the curves are still converging, more data helps; if they have flattened apart, it will not", weight: 2, patterns: ["converg", "flatten", "plateau", "still (falling|dropping|improving)"] },
      { id: "remedies", label: "Remedies for variance: more data, regularisation, a simpler model, augmentation", weight: 2, patterns: ["regulari[sz]", "simpler", "augment", "early stop", "dropout", "fewer features"] },
      { id: "bias", label: "Contrast with high bias, where both errors are high and capacity is the lever", weight: 2, patterns: ["bias", "both (errors|curves)", "underfit"] },
    ],
    mechanism:
      "The two errors tell you which regime you are in. High training error and high validation error means high bias: the model is too weak, so add capacity or features. Low training error and a large validation gap means high variance: the model memorises. Learning curves, which plot both errors as the training set grows, show whether the gap is still closing, in which case more data pays off, or has flattened, in which case regularisation or a simpler model is the better use of the budget.",
    clincher:
      "Low training error and a big gap is variance, so a bigger model is the wrong lever: I plot learning curves to see if more data still closes the gap, and otherwise regularise or simplify.",
  },
];
