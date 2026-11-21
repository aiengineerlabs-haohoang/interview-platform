import type { QuestionInput } from "../../types";

/** More questions for this floor, converted from verified posts. See docs/CONTENT.md. */
export const REINFORCEMENT_LEARNING_MORE: QuestionInput[] = [
  {
    id: "pushed-up-less",
    room: "reinforcement-learning",
    level: "mid",
    title: "The one-way gradient",
    prompt:
      "A colleague explains policy gradient as 'it raises the probability of good actions and lowers the probability of bad ones'. Your environment pays a reward that is never negative. Is that explanation right for your setup, and what would you change?",
    trap: {
      saying: "Policy gradient pushes good actions up and bad actions down, so low reward actions get pushed down automatically.",
      whyWrong: "With rewards that are never negative every sampled action is weighted positively, so a bad action is only pushed up less, never down.",
      patterns: ["pushes? (good|bad).{0,30}(up|down)", "bad actions? (get|are) (pushed|pushes) down", "lowers? the probability of (the )?bad"],
    },
    points: [
      { id: "positive", label: "With a non-negative return every sampled action gets a positive weight, so everything sampled is pushed up", weight: 3, patterns: ["never negative", "non.?negative", "all (the )?(returns|rewards) (are )?positive", "positive weight", "pushed up", "only pushes? up"] },
      { id: "less", label: "A low reward means the action is pushed up less, not pushed down", weight: 3, patterns: ["up less", "less than", "not pushed down", "never pushed down"] },
      { id: "baseline", label: "Subtract something that does not depend on the action, a baseline", weight: 3, patterns: ["baseline", "subtract"] },
      { id: "advantage", label: "Pushing down worse than average actions is a property of the advantage, not of the raw return", weight: 3, patterns: ["advantage", "better than average", "worse than average", "than average"] },
      { id: "ml", label: "Contrast with maximum likelihood, where every example has weight one", weight: 1, patterns: ["maximum likelihood", "\\bmle\\b", "weight (of )?(1|one)"] },
    ],
    mechanism:
      "Under maximum likelihood every example carries the same positive weight on the gradient of its log-probability. With a reward that is never negative the policy gradient behaves the same way: every sampled action enters the update with a positive weight, and a poor outcome simply gets a smaller one. The better-than-average and worse-than-average behaviour comes from the advantage, which only appears once you subtract a baseline that does not depend on the action.",
    clincher:
      "With a reward that is never negative the policy gradient only pushes up what it sampled, and a bad outcome is pushed up less. Pushing down worse-than-average actions is a property of the advantage, so you need a baseline that does not depend on the action.",
  },
  {
    id: "cap-is-not-an-ending",
    room: "reinforcement-learning",
    level: "mid",
    title: "The episodes that hit the cap",
    prompt:
      "Your episodes end in one of two ways: the task fails, or you hit the step limit. Your loop bootstraps a value of zero whenever the environment says the episode is over, and your best episodes are the ones that reach the limit. What is the value function learning, and how do you fix it?",
    trap: {
      saying: "If the episode is over there is no next state, so a zero target is correct by definition.",
      whyWrong: "A step cap is the rollout running out, not the task ending, so a zero target teaches the critic that your best states are worthless.",
      patterns: ["no next state", "zero (target|bootstrap).{0,30}(correct|fine|right)", "over (so|then) (the )?(value|target) (is )?(zero|0)"],
    },
    points: [
      { id: "trunc", label: "Distinguish a true termination from a truncation caused by a time limit", weight: 3, patterns: ["truncat", "time limit", "step (cap|limit)", "terminated"] },
      { id: "zero-wrong", label: "A zero target at a cut off state teaches the value function that good states are worth nothing", weight: 3, patterns: ["worth (nothing|zero)", "zero target", "bootstrap (of )?zero", "wrongly zero", "underestimat", "teaches"] },
      { id: "fix", label: "Bootstrap with your own value estimate of the state you cut at, and use zero only on a real terminal", weight: 3, patterns: ["bootstrap.{0,40}(value|v of|estimate)", "only (on|at|for) (a )?(true|real) terminal", "value of the (cut|last|final) state"] },
      { id: "advantage", label: "Advantages built from that value inherit the error", weight: 2, patterns: ["advantage", "gae", "td (error|residual)", "downstream"] },
      { id: "best", label: "The error lands on the best trajectories, the ones you want to reinforce", weight: 2, patterns: ["best (episodes|trajectories)", "good (episodes|trajectories)", "reinforce", "improves"] },
    ],
    mechanism:
      "A real terminal state has no future reward, so a zero bootstrap target is a fact there. A step limit is different: the state was healthy and the rollout was merely cut, so the true value is not zero. Treating both as the same flag teaches the value function that the states reached at the cap are worthless, and every advantage computed from that value inherits the mistake. Because the best episodes are the ones that reach the cap, the error falls on exactly the trajectories you want to reinforce.",
    clincher:
      "Hitting the step cap is a truncation, not a termination. I bootstrap with my own value of the cut state and use zero only on a true terminal, otherwise the critic learns that my best states are worthless.",
  },
  {
    id: "clip-is-not-a-fence",
    room: "reinforcement-learning",
    level: "staff",
    title: "Ratios the clip let through",
    prompt:
      "Your PPO run uses a clip range of 0.2. One batch logs probability ratios far above 1 and far below 1, and the KL to the old policy keeps climbing. A teammate says clipping makes that impossible, so there must be a bug. What is actually happening?",
    trap: {
      saying: "The ratio is clamped into the clip range by construction, so seeing values outside it means we have a bug.",
      whyWrong: "Clipping removes the incentive to move the ratio further; it does not project the ratio or the KL back into any set, and it acts per sample depending on the sign of the advantage.",
      patterns: ["clamped (into|to)", "impossible", "by construction", "must be a bug"],
    },
    points: [
      { id: "incentive", label: "Clipping removes the incentive to move the ratio outside the range; it is not a hard bound", weight: 3, patterns: ["incentive", "not a (hard )?(bound|constraint|limit)", "does not (bound|constrain)", "doesn.t (bound|constrain)", "nothing (projects|enforces)"] },
      { id: "sign", label: "The clip acts per sample depending on the sign of the advantage, and it is one sided", weight: 3, patterns: ["sign of the advantage", "positive advantage", "negative advantage", "one.?sided", "depending on"] },
      { id: "pessimistic", label: "The minimum of clipped and unclipped terms keeps the worse case, so a bad update is not ignored", weight: 2, patterns: ["minimum", "\\bmin\\b", "pessimistic", "lower bound", "makes the objective worse"] },
      { id: "kl", label: "Nothing bounds the KL either, so monitor KL and stop the epochs early when it passes a target", weight: 3, patterns: ["early stop", "stop (the )?(epochs|updates|gradient)", "target kl", "kl threshold", "monitor.{0,10}kl"] },
      { id: "instrument", label: "Log ratio distribution and clip fraction, split by advantage sign", weight: 1, patterns: ["clip fraction", "ratio distribution", "split by", "log the ratio"] },
    ],
    mechanism:
      "The clipped objective stops paying for moving a ratio beyond the range, but nothing forces the parameters back inside it. Taking the minimum of the clipped and unclipped terms makes the objective pessimistic: when the ratio has moved in a direction that makes the objective worse, that term is kept at full strength, so with a negative advantage a large ratio is deliberately left unclipped. Large ratios and growing KL are therefore not evidence of a bug, and the practical protection is to monitor the KL to the old policy and stop optimising a batch once it passes a target.",
    clincher:
      "No bug: clipping removes the incentive to move the ratio past the range, it does not bound it, and it is one sided per sample by the sign of the advantage. What bounds drift is monitoring KL and stopping early, not a tighter clip.",
  },
  {
    id: "dpo-keeps-the-reward-model",
    room: "reinforcement-learning",
    level: "senior",
    title: "The reward model that went missing",
    prompt:
      "Your pipeline is supervised fine-tuning, then a reward model, then PPO. A candidate proposes replacing the middle two stages with one classification loss over the same preference pairs and says the reward model is gone. Is it, and what do you trade away?",
    trap: {
      saying: "Yes, DPO deletes the reward model and gets you to the same place with a simpler loss.",
      whyWrong: "DPO reparameterises the reward model rather than removing it, and the swap gives up sampling from the current policy and a reusable scorer.",
      patterns: ["deletes? the reward model", "reward model is gone", "same place", "no (need for|longer need) (a )?reward model"],
    },
    points: [
      { id: "reparam", label: "DPO reparameterises the reward model in terms of the policy and a reference model; it does not remove it", weight: 3, patterns: ["reparam", "secretly a reward model", "implicit reward", "language model is.{0,20}reward model", "reward is.{0,30}(log )?ratio"] },
      { id: "fixed", label: "Preference data is a fixed dataset collected once, not scored on fresh samples from the current policy", weight: 3, patterns: ["fixed (data|dataset|pairs)", "offline", "off.?policy", "fresh samples", "current policy", "on.?policy", "sampl\\w* (from|during)"] },
      { id: "reuse", label: "A separate reward model can be reused for best of n, evaluation gating or new prompts", weight: 2, patterns: ["best.?of.?n", "reus", "gating", "new prompts?", "scorer", "evaluation"] },
      { id: "gain", label: "What you gain: one loss, no critic, no reward model serving, fewer hyperparameters", weight: 2, patterns: ["simpl", "no critic", "lightweight", "fewer hyperparameters", "stable", "one loss"] },
      { id: "stack", label: "The methods are not exclusive; strong recipes can stack preference tuning and then RL", weight: 1, patterns: ["stack", "then rl", "followed by", "both", "combine", "complement"] },
    ],
    mechanism:
      "DPO rewrites the standard RLHF problem so that the reward is expressed through the policy itself, which lets it be trained with a simple classification loss on preference pairs and a frozen reference model. The reward model is reparameterised, not deleted. The trade is that no new samples are drawn from the model during fine-tuning, so nothing scores behaviour the policy picks up later, and there is no separate scorer to reuse for best-of-n or evaluation. In exchange you drop the critic, reward model serving and much of the tuning burden.",
    clincher:
      "The reward model is reparameterised, not deleted. DPO is simpler and cheaper, but you give up scoring fresh samples from the current policy and a reusable scorer, which is why DPO and RL are often stacked rather than chosen between.",
  },
  {
    id: "identical-samples-no-gradient",
    room: "reinforcement-learning",
    level: "senior",
    title: "Sixteen samples, one answer",
    prompt:
      "Several hundred steps into a group relative policy optimisation run, the samples drawn for each prompt come back nearly identical, training reward is flat and pass@k is below where you started. A teammate wants to widen the clip range in both directions. What is happening and what do you do?",
    trap: {
      saying: "The updates are being throttled by the clip, so let bigger steps through in both directions.",
      whyWrong: "Identical samples give groups with no reward variance, so every group relative advantage is zero and there is no gradient; the clip is not what stopped the run.",
      patterns: ["widen (the )?clip", "clip.{0,30}(throttl|too tight|limiting)", "bigger steps", "both directions"],
    },
    points: [
      { id: "zero-adv", label: "When all samples in a group get the same reward every group relative advantage is zero, so the gradient is zero", weight: 3, patterns: ["zero advantage", "advantage (is )?(zero|0)", "no (variance|gradient|signal)", "zero (gradient|variance)", "same reward"] },
      { id: "collapse", label: "Upstream cause is entropy collapse: the policy lost sampling diversity", weight: 3, patterns: ["entropy", "collaps", "diversity", "lost (the )?variety"] },
      { id: "filter", label: "Drop or filter groups that are all correct or all wrong, and keep the effective batch size up by oversampling", weight: 3, patterns: ["filter", "drop", "dynamic sampling", "all (correct|wrong)", "oversampl", "discard"] },
      { id: "mix", label: "Fix the prompt mix toward medium difficulty and use a curriculum for hard prompts", weight: 2, patterns: ["difficulty", "curriculum", "medium", "prompt mix", "harder"] },
      { id: "upper", label: "If touching the clip, raise only the upper bound to give low probability tokens room, rather than both sides", weight: 2, patterns: ["upper (bound|clip)", "clip.?higher", "only (the )?upper", "one side", "asymmetric"] },
    ],
    mechanism:
      "Group relative advantages are differences from the group mean, so if every sample in the group earns the same reward all advantages are zero and the policy gradient is zero. A flat reward curve in that state is an empty batch, not a plateau, and the fall in pass@k shows that diversity was lost, which is entropy collapse. The fix starts with restoring gradient: filter groups with all correct or all wrong outcomes, oversample so the effective batch stays full, and rebalance prompt difficulty. If the clip is changed at all, raising only the upper bound gives low probability tokens room to grow, which addresses entropy collapse directly and is not the same as widening both sides.",
    clincher:
      "Identical samples mean zero variance groups and zero advantage, so the run is training on nothing. I filter the degenerate groups, fix the difficulty mix, and if I touch the clip I raise only the upper bound.",
  },
  {
    id: "where-the-kl-sits",
    room: "reinforcement-learning",
    level: "staff",
    title: "A toll on every token",
    prompt:
      "Your reasoning RL run will not grow its chains of thought: response length stays flat for thousands of steps, while a public recipe on the same base model sees length grow. Both use a KL penalty to a reference model. Where do you look first?",
    trap: {
      saying: "Length growth is emergent, so train longer or raise the maximum length and it will appear.",
      whyWrong: "A per-token KL charged as a reward taxes every extra token, so length can be suppressed by the objective itself, and a max length cap can also be the real ceiling.",
      patterns: ["length (growth )?is emergent", "train (for )?longer", "just raise the max", "will appear"],
    },
    points: [
      { id: "side", label: "Check which side the KL is on: a per token penalty added to the reward versus a term added to the loss", weight: 3, patterns: ["dense reward", "per.?token (kl|penalty)", "added to the (reward|loss)", "reward side", "loss side", "in the loss"] },
      { id: "tax", label: "A per token penalty charges every extra token, so it can implicitly penalise length", weight: 3, patterns: ["penali[sz]e length", "every (extra )?token", "taxes? length", "longer (answers?|responses?) cost", "cumulative"] },
      { id: "cap", label: "Check the maximum length cap; flat length can be a cap and not the policy", weight: 2, patterns: ["max(imum)? (length|tokens)", "cap", "ceiling", "truncat"] },
      { id: "beta", label: "Check the KL coefficient and what the reference model is: frozen, refreshed or dropped", weight: 3, patterns: ["beta", "coefficient", "frozen", "refresh", "periodically updat", "drop(ped)? the kl", "reference (model|policy)"] },
      { id: "diag", label: "The KL in the objective and the KL logged as a diagnostic are different things", weight: 1, patterns: ["diagnostic", "snapshot", "old policy", "separate (copy|copies)"] },
    ],
    mechanism:
      "Where the KL penalty is placed decides whether longer answers can pay off. When a per-token KL is added as a dense reward, the penalty accumulates with every token, so a longer answer pays more before it earns anything and the objective can suppress length growth. When the KL is a regularisation term in the loss, length is not taxed that way. So the first checks are which side the KL is on, its coefficient, whether the reference model is frozen, periodically refreshed or dropped, and whether the maximum length cap is the real ceiling.",
    clincher:
      "Length is not purely emergent. A per-token KL added to the reward charges every extra token, so I check which side my KL is on, its coefficient, whether the reference is frozen or refreshed, and whether the max length is the real ceiling.",
  },
  {
    id: "gamma-is-not-a-knob",
    room: "reinforcement-learning",
    level: "senior",
    title: "Just set gamma to 0.99",
    prompt:
      "A teammate says discounting is a general purpose knob: set gamma to 0.99 on any environment and see if it helps. Your task gives a single reward at the end of a very long episode. What do you tell them?",
    trap: {
      saying: "Discounting is just a tuning knob, so set gamma to 0.99 and see if it helps.",
      whyWrong: "Gamma either lives inside the return and changes the objective, or it is used as variance reduction and biases the gradient; there is no free third option.",
      patterns: ["just (a )?(tuning )?knob", "set gamma", "see if it helps", "try it and see"],
    },
    points: [
      { id: "objective", label: "If gamma is part of the return, lowering it changes what optimal means", weight: 3, patterns: ["changes? (the|what).{0,20}(objective|optimal)", "different (problem|objective)", "inside the return", "part of the (return|objective)"] },
      { id: "bias", label: "Used as variance reduction, a gamma below one biases the policy gradient even with an accurate value function", weight: 3, patterns: ["bias", "variance reduction", "regardless of"] },
      { id: "decay", label: "With one reward at the end, discounting shrinks the weight of the earliest steps, which is the plan you want to train", weight: 3, patterns: ["earliest", "early (steps|tokens|actions)", "geometric", "decays?", "long horizon", "far.{0,10}reward"] },
      { id: "eval", label: "Evaluate on the undiscounted return, not the discounted curve you just changed", weight: 2, patterns: ["undiscounted", "same metric", "ruler", "grading (the|your) own", "evaluat\\w* (on|with)"] },
      { id: "lambda", label: "Lambda in GAE is a separate dial that trades bias against variance depending on critic accuracy", weight: 1, patterns: ["lambda", "\\bgae\\b", "generali[sz]ed advantage"] },
    ],
    mechanism:
      "Gamma can be read in two ways. Inside the return it defines the objective, so changing it means you are solving a different problem. Treated as a variance reduction parameter in an undiscounted problem, a value below one introduces bias into the policy gradient regardless of how good the value function is. With a single terminal reward at the end of a long episode, discounting also decays the weight on the earliest decisions geometrically, which are often the ones you most need to train. And judging the change by the discounted training curve means grading the new objective with its own metric.",
    clincher:
      "Gamma is not a free knob: either it is in the return and lowering it changes the objective, or it is variance reduction and it biases the gradient. I would say which I mean and evaluate on the undiscounted return.",
  },
];
