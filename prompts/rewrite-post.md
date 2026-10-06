# Prompt — rewrite post

Runtime prompt for a failed draft. Run when `score-post.mjs` returns `reject` or
`revise`.

The most common failure is `hard_blocks: 0` with a low score. Those are not
rewrite problems — they are plan problems. Check `next_actions` for a finding in
`s2` (unsourced claim) or `vd3` (repetition against history) and go back to
`playbooks/04-content-calendar.md` instead.

## Inputs

| Field | Source |
|---|---|
| `draft` | the post file, including its `score.findings` |
| `lowest` | the lowest-scoring 2 computed dimensions |
| `persona` | `persona/*.yaml` |
| `history` | `output/published.jsonl` |

## Prompt

```
You are revising one LinkedIn post. The original failed a rubric.

## Do not rewrite from scratch
Keep whatever already scored well. A rewrite that discards the parts working
means the next version loses the parts that were working. Identify them first
and preserve them.

## What failed
{findings: check_id, label, measured, target, offending, fix}

The two lowest dimensions are: {lowest}

## Hard constraints — unchanged from generation
- every number in proof.yaml with tier and source, or absent
- no client, employer, or colleague named
- no phrase from content/slop-blacklist.md
- exactly one CTA, after 60% of the post, not from the forbid list
- 3-5 hashtags, no emoji
- first line under 130 characters, under 18 words
- plain text, 900-2000 characters

## Voice — unchanged
{tone}, {point_of_view.person}, {sentence.target_words}-word target sentences,
{paragraph.max_lines}-line paragraphs, never {tone.never}

## Specifically fix
{for each failing check, the rubric's own words:
 "measured X, target Y" becomes the instruction}

## Preserve
{list the sentences or structure elements that passed, named explicitly}

## Also change
{randomise the opening completely. A rewrite that keeps the first line keeps
 the main reason it was weak. Do not use any 4-word sequence present in history.}

## Output
Return JSON matching schemas/post.schema.json, plus:
{
  "revision": {
    "round": {n+1},
    "changed": ["specific list of what changed and why"],
    "kept": ["what was preserved and why it scored"]
  },
  "remaining_risks": ["constraints still in tension after this revision"]
}

`remaining_risks` matters. If a fix trades one rubric failure for another — for
example adding specificity pushes the post over 2000 characters — say so. Do not
claim a clean fix when there is a trade-off.
```

## Limits

Maximum three rounds. After that, `brand-consistency.yaml` stop condition
`sc_stop_2` applies: three consecutive rejects means the plan is wrong, and a
fourth rewrite is wasted effort. Go back to the calendar and change the slot.

Record `revision.round`. `score-post.mjs` does not enforce this; the playbook
does.

## Tone of the changed list

`specific list of what changed and why`, not "improved the hook". Every entry
must name what is different and what measurement drove it. If you cannot point
at a measurement, you have not changed anything measurable — say that instead.