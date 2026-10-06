# Hook Patterns

`score-post.mjs` check `h2` matches the opening line against these ten
families. A hook that matches nothing loses 6 of 20 points in the hook
dimension.

Line 1 must also be under 130 characters and under 18 words (check `h1`).
Long hooks are not hooks.

---

## 1. Cost-first

Names the price of the status quo, in the reader's units.

- `You are paying for this twice and noticing neither.`
- `That report takes six hours a week. You have never once looked at where it goes.`
- `The most expensive line in your budget is the one nobody itemised.`

Needs a real number from `proof.yaml` or an observation marked as such.

## 2. Wrong-belief

Names a belief the reader holds and opens the possibility it is wrong.

- `Most teams do not have a hiring problem. They have a first-90-days problem.`
- `The thing everyone agrees on in this field is the part that does not work.`
- `Nobody is doing this because of the reason usually given.`

Check against `pov-map.hot_takes` or `anti_positions`. Do not invent a myth.

## 3. Observation

Reports a pattern noticed in real work, dated.

- `Nine projects this year. Same failure point every time.`
- `I have watched this get worse for about eighteen months.`
- `Something shifted in this industry around last spring and it has not reversed.`

Must carry the timeframe. "Recently" is not a timeframe.

## 4. Number-list

Promises a specific count, then delivers exactly that many.

- `Five checks that find most of the cost in an unmanaged process.`
- `Three steps. About ninety minutes.`
- `Seven questions worth asking before you sign a service agreement.`

The count must be exact. Promising five and delivering four is worse than not
listing.

## 5. Direct-question

Asks something the reader wants answered, specifically.

- `What do you do when the person who built the process has left?`
- `Which part of your documentation is actually read?`
- `How long does it take to find out who approved this?`

Must be answerable. A rhetorical question wearing a question mark is banned
("here is the thing", "let that sink in").

## 6. Contrast

Sets up two things that are usually treated as the same.

- `Everyone calls this automation. It is not automation.`
- `The prompt is easy. The review step is the job.`
- `Faster is not the same as cheaper.`

## 7. Story-open

Opens in the middle of something that happened.

- `The client called about a missing quarter. Nothing had crashed.`
- `Last month a process I had recommended twice was quietly abandoned.`
- `The first version worked perfectly and was useless.`

## 8. Consequence

States what follows, concretely.

- `Run this without the review step and you will find out in month three.`
- `Skip this and the audit becomes a redesign.`
- `There is no version of this where the spreadsheet keeps working.`

## 9. Proof-first

Leads with the result.

- `Twelve invoices a week became four. Same team, same headcount.`
- `We cut onboarding from fourteen days to three in one quarter.`
- `Forty percent less handling. The number came from the client's own log.`

Only from `proof.yaml`, only with a valid tier. `check-voice.mjs` blocks
unsourced numbers outright.

## 10. Demonstrable

Promises something the reader can do immediately.

- `Here is the query that finds the three accounts worth chasing.`
- `Copy this checklist into your next process review.`
- `This is the whole spreadsheet. Four columns.`

---

## Rules

**One family per post.** Mixing two families across the opening blurs it.

**Never reuse an opening line.** `brand-consistency.yaml` flags three or more
posts sharing a hook verbatim.

**The hook must be true.** Family 9 and family 3 both require real content
behind them. A cost-first hook about a cost that is not that cost is the fastest
way to lose a reader who comes back.

**Banned openings, regardless of family:** "here is the thing", "let that sink
in", "buckle up", "without further ado", "picture this", "imagine this", "let me
be honest", "no fluff". These are in `content/slop-blacklist.md` and
`check-voice.mjs` hard-fails on them.

## Worked examples of the failure mode

```
Bad:  In today's fast-paced world, businesses are constantly seeking ways to
      leverage automation to unlock efficiency.
Good: Your team is probably paying for the same work twice.
```

The second is 10 words, names a specific situation, and creates a question the
rest of the post answers. The first says nothing, and is hard-banned in four
places.