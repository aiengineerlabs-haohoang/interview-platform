# Questions and the rubric

## Review before promoting

The 20 seed questions were drafted from general, well-established knowledge, with no invented figures. The only
numbers are the "5-10x expected, 1.3x seen" in `prompt-cache-prefix` (from a published post) and arithmetic examples
such as "one in a hundred". They are in the author's voice and **have not been through the fact-check agent**. Before a
question is promoted on LinkedIn or Substack, run it through the same independent fact-check as a post.

Questions must not name the source of an idea (a course, a university, a lecturer): `content.test.ts` fails the build
if one does.

## A question

`packages/shared/src/content/<room>.ts`, parsed by `QuestionSchema` in `types.ts`:

| field | what it is |
|---|---|
| `id` | kebab-case, unique, appears in share links (`/?q=<id>`), so never rename a live one |
| `room` | one of the five floors |
| `level` | `mid`, `senior`, `staff` |
| `prompt` | what the interviewer says, in full |
| `trap.saying` | the confident wrong answer, in the candidate's voice |
| `trap.whyWrong` | one or two sentences |
| `trap.patterns` | regexes; matching one while scoring under 50 makes the interviewer call the trap |
| `points` | 3-7 things a strong answer says: `{ id, label, weight 1-3, patterns[] }` |
| `mechanism` | one short paragraph |
| `clincher` | the sayable answer |

## The rubric

Patterns are case-insensitive regexes run over the normalised answer (lower case; hyphens, underscores and slashes
become spaces; punctuation removed). A point is hit if **any** of its patterns matches. Score is the weight of the hit
points over the total, rounded. Under 12 words nothing can be hit.

Write patterns for the *ideas*, not the exact phrase: `append` not `append-only`, `iteration.?level` not
`iteration-level scheduling`. Then run `npm test -w @tower/shared`: the suite checks that every pattern compiles, that a
blank or clueless answer scores under 30, and that the question's own `clincher + mechanism` scores at least 60. If the
last one fails the rubric and the model answer disagree, which is a content bug.

Verdict thresholds (`scoring.ts`): 80+ strong hire, 55+ hire, 30+ lean no hire, below that no hire; a sprung trap is a
no hire.
