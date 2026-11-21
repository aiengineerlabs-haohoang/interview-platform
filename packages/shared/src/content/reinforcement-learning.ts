import type { QuestionInput } from "../types";

export const REINFORCEMENT_LEARNING: QuestionInput[] = [
  {
    id: "reward-hacking",
    room: "reinforcement-learning",
    level: "senior",
    title: "The reward is going up and the model is getting worse",
    prompt:
      "You are fine-tuning a language model with RL against a learned reward model. Reward climbs steadily, but human reviewers say the outputs are getting longer, more flattering and less useful. What is happening and what do you do?",
    trap: {
      saying: "Reward is going up, so the training is working. Train longer and it will fix itself.",
      whyWrong: "The policy is optimising the proxy, not the goal. The more optimisation pressure you apply, the more it exploits whatever the reward model gets wrong.",
      patterns: ["reward (is|keeps) (going )?up.{0,20}(working|good)", "train (for )?longer", "it will fix itself"],
    },
    points: [
      { id: "proxy", label: "The reward model is a proxy; the policy exploits its errors (reward hacking, Goodhart)", weight: 3, patterns: ["proxy", "reward hack", "goodhart", "exploit", "over.?optimi[sz]"] },
      { id: "kl", label: "Constrain drift from the reference model with a KL penalty", weight: 3, patterns: ["\\bkl\\b", "kullback", "reference (model|policy)", "stay close"] },
      { id: "holdout", label: "Judge by something the optimiser cannot see: human review or a held-out evaluation", weight: 3, patterns: ["held.?out", "human", "separate (eval|reward)", "independent", "gold"] },
      { id: "inspect", label: "Read the samples: length, style and sycophancy patterns show up there first", weight: 2, patterns: ["read (the )?(samples|outputs)", "inspect", "length", "sycophan", "flatter"] },
      { id: "fix-rm", label: "Improve the reward model: more data on failures, ensembles or an early-stopping point", weight: 2, patterns: ["ensemble", "retrain (the )?reward", "reward model (data|update)", "early stop", "more (preference )?data"] },
    ],
    mechanism:
      "A learned reward model is only a proxy for what people want, and a policy under optimisation pressure finds the places where the proxy and the goal disagree, such as length or flattery. Rising reward is therefore not evidence of improvement. The remedies are to limit how far the policy can move from a reference model with a KL penalty, to evaluate with signals the optimiser never sees, to read samples regularly, and to repair the reward model with data from the failures you find.",
    clincher:
      "Reward is a proxy and the policy is exploiting it, so I add a KL penalty to a reference model, judge progress with held-out human evaluation rather than the reward itself, and feed the failures back into the reward model.",
  },
  {
    id: "ppo-clipping",
    room: "reinforcement-learning",
    level: "staff",
    title: "Why PPO clips",
    prompt:
      "Vanilla policy gradient throws away each batch of experience after one update, which is wasteful. Why can you not simply reuse the batch for several gradient steps, and how does PPO make that safe?",
    trap: {
      saying: "You can reuse the batch as many times as you like, since the data is still valid experience.",
      whyWrong: "After the first update the policy is no longer the one that generated the data, so the gradient estimate is biased and a large step can wreck the policy.",
      patterns: ["reuse (it|the batch).{0,20}(as many|any number|freely)", "data is still valid", "no problem reusing"],
    },
    points: [
      { id: "on-policy", label: "Policy gradient is on-policy: the data must come from the current policy", weight: 3, patterns: ["on.?policy", "current policy", "policy that (generated|collected)", "stale", "old policy"] },
      { id: "ratio", label: "Reusing needs the probability ratio between new and old policy (importance sampling)", weight: 3, patterns: ["ratio", "importance (sampling|weight)"] },
      { id: "variance", label: "A large ratio makes the estimate high variance or unreliable", weight: 1, patterns: ["variance", "unreliable", "unstable", "blow"] },
      { id: "clip", label: "PPO clips the ratio so a single batch cannot push the policy far from the old one", weight: 3, patterns: ["clip", "trust region", "bound the (ratio|update)", "small step"] },
      { id: "epochs", label: "That makes several epochs of minibatch updates on one batch safe and sample-efficient", weight: 2, patterns: ["epoch", "minibatch", "mini.?batch", "sample.?efficien", "multiple (updates|steps|gradient)"] },
    ],
    mechanism:
      "The policy gradient is an expectation under the policy that produced the data, so after one update the batch is slightly off-policy. You can correct for that with the ratio of new to old action probabilities, but that ratio becomes extreme if the policy moves far and the estimate then has high variance. PPO clips the ratio, which removes the incentive to move beyond a small neighbourhood of the old policy, so running several epochs of minibatch updates on one batch is safe and uses the data more efficiently.",
    clincher:
      "Policy gradient is on-policy, so a reused batch needs an importance ratio, and PPO clips that ratio so the policy cannot move far enough from the data-collecting policy for the reuse to hurt.",
  },
  {
    id: "baseline-variance",
    room: "reinforcement-learning",
    level: "mid",
    title: "Why subtract a baseline",
    prompt:
      "In REINFORCE you subtract a baseline from the return before multiplying by the gradient of the log-probability. A junior engineer says this changes what the policy learns and wants to remove it. What do you tell them?",
    trap: {
      saying: "Subtracting something from the return biases the gradient, so the baseline changes the objective and should go.",
      whyWrong: "A baseline that does not depend on the action leaves the expected gradient unchanged. It only reduces the variance of the estimate.",
      patterns: ["biases? the gradient", "changes? (what|the objective)", "should (go|be removed)", "remove the baseline"],
    },
    points: [
      { id: "unbiased", label: "A baseline that does not depend on the action leaves the expected gradient unchanged", weight: 3, patterns: ["unbiased", "does not (change|bias)", "doesn.t (change|bias)", "expected gradient", "same expectation", "no bias", "not depend on the action", "independent of the action"] },
      { id: "variance", label: "It reduces the variance of the gradient estimate, so learning is steadier and faster", weight: 3, patterns: ["variance"] },
      { id: "why-zero", label: "The expectation of the score function is zero, which is why the baseline term vanishes", weight: 2, patterns: ["score function", "expectation (of|is) zero", "sums? to zero", "equals zero", "integrates? to"] },
      { id: "advantage", label: "A value function baseline gives the advantage: how much better than average this action was", weight: 2, patterns: ["advantage", "value function", "average", "better than expected"] },
      { id: "action-dep", label: "Warn: a baseline that depends on the action reintroduces bias", weight: 1, patterns: ["depends on the action", "action.dependent", "action dependent"] },
    ],
    mechanism:
      "Without a baseline, every action in a trajectory with a large positive return is pushed up, even if the return was large for reasons unrelated to that action, which makes the gradient noisy. Subtracting a baseline that does not depend on the action does not change the expected gradient, because the expectation of the gradient of the log-probability is zero, but it shrinks the variance. A learned value function as the baseline turns the return into an advantage: how much better than average this action was.",
    clincher:
      "Keep the baseline: as long as it does not depend on the action it leaves the expected gradient unchanged and just cuts the variance, which is what the advantage in actor-critic methods builds on.",
  },
  {
    id: "sparse-reward-exploration",
    room: "reinforcement-learning",
    level: "senior",
    title: "The agent that never sees a reward",
    prompt:
      "Your agent only receives a reward when it completes a long multi-step task, and after a week of training it has never once succeeded, so the policy gradient is zero. Epsilon-greedy has not helped. What are your options, and what are the risks of each?",
    trap: {
      saying: "Add more random exploration, or just train longer, and it will stumble on the goal eventually.",
      whyWrong: "In a long task the chance of reaching the goal by random actions shrinks exponentially with the number of steps, so more randomness and more time rarely help.",
      patterns: ["more (random )?exploration", "train (for )?longer", "stumble", "eventually"],
    },
    points: [
      { id: "exp", label: "Random exploration succeeds with exponentially small probability on long tasks", weight: 2, patterns: ["exponential", "needle", "haystack", "vanishing(ly)? (small|rare)", "never (reach|see)"] },
      { id: "demo", label: "Start from demonstrations or a pretrained or imitation-learned policy", weight: 3, patterns: ["demonstration", "imitation", "pre.?train", "behaviou?r(al)? cloning", "supervised (fine.?tun|start)", "warm start"] },
      { id: "curriculum", label: "Use a curriculum: start close to the goal or on easier tasks and move back", weight: 3, patterns: ["curriculum", "easier", "closer to the goal", "reverse", "subgoal", "sub.?goal"] },
      { id: "shaping", label: "Shape the reward with intermediate signals, carefully, since shaping can be exploited", weight: 3, patterns: ["shap", "intermediate (reward|signal)", "dense", "progress (reward|signal)", "potential.?based"] },
      { id: "intrinsic", label: "Intrinsic motivation or novelty bonuses encourage covering new states", weight: 1, patterns: ["intrinsic", "novelty", "curiosity", "count.?based"] },
    ],
    mechanism:
      "If a reward is only given at the end of a long task and random behaviour essentially never reaches it, there is no learning signal at all. The fixes all inject information the reward does not: demonstrations or a pretrained policy that already gets partial credit, a curriculum that begins near the goal, shaped intermediate rewards, or intrinsic exploration bonuses. Each carries a risk, most notably that a shaped reward gives the policy a new proxy to exploit, so shaping should be potential-based or checked against the true reward.",
    clincher:
      "Random exploration cannot find a rare long-horizon reward, so I would warm-start from demonstrations or a pretrained policy, add a curriculum, and use carefully shaped intermediate rewards while checking they cannot be exploited.",
  },
];
