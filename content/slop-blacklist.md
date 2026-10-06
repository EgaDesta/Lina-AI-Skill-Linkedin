# Slop Blacklist

The authoritative lists live in `scripts/lib/slop.mjs` — that is what the code
reads. This file explains each group and why it exists.

Three levels:

- **Hard ban** — zero occurrences. No context rescues it.
- **Soft tell** — up to one per post. Two or more reads as machine output.
- **Repeated tell** — any phrase appearing three or more times. `check-voice.mjs`
  flags these separately and they fail the check.

## Hard bans

### Self-reference
`as an ai`, `ai-generated`, `in this response`, `hope this helps`, `here is the rewritten`

Nothing damages a professional feed faster than a reader realising it is synthetic.
This is why Lina writes as a person with a real history, and why `proof.yaml`
refuses to let it invent that history.

### Empty abstraction
`delve into`, `dive deep into`, `navigating the landscape`, `ever-evolving landscape`, `fast-paced world`, `in today's world`, `the digital age`

These name no actor, no action, no outcome. They exist to make text longer.

### Stacked intensity
`unlock the power`, `game-changer`, `revolutionary`, `cutting-edge`, `next-level`, `10x`, `skyrocket`

Intensity without information. Two of these in one post reads as a sales page.

### Buzzword soup
`synergy`, `holistic approach`, `robust solution`, `actionable insights`, `key learnings`, `thought leader`, `paradigm shift`, `low-hanging fruit`, `move the needle`, `evergreen content`, `content machine`

Some of these are fine in a corporate document. In a personal feed they mark
the writer as someone writing from outside the work.

### Formulaic openings
`here is the thing`, `let that sink in`, `buckle up`, `without further ado`, `picture this`, `imagine this`, `read that again`, `sit with that`, `let me be honest`, `no fluff`

Each is individually defensible. As a set they are a fingerprint that readers
learn to recognise in three posts.

### Engagement farming
`like and share`, `smash that`, `drop a comment if you agree`, `tag someone who needs to see`, `follow for more`, `this will change your life`, `this changed everything`

These also appear in `offers.cta_policy.forbid`.

### Structural filler
`in conclusion`, `furthermore`, `moreover`, `in order to`, `when it comes to`, `at the end of the day`, `the fact of the matter`, `only time will tell`, `the best is yet to come`

## Soft tells

Filler that substitutes for a specific fact. `check-voice.mjs` allows one per
post and reports which one.

- Emphasis words with nothing attached: `very`, `really`, `truly`, `extremely`, `simply`, `actually`, `literally`, `basically`, `essentially`
- Unfalsifiable approval: `impressive`, `innovative`, `exciting`, `transformative`, `robust`, `significant`, `substantial`
- Corporate substitution: `leverage`, `utilize`, `holistic`, `empower`
- Self-description with no evidence: `passion`, `passionate about`, `results-driven`, `detail-oriented`, `self-starter`, `proven track record`
- Hedges standing in for evidence: `i have seen`, `in my experience`, `the truth is`, `i think`, `i believe`, `i would say`, `kind of`, `i guess`
- Vague quantifiers: `many`, `most`, `several`, `numerous`, `various`, `a range of`, `plenty of` — each should be a number, and a number needs a `proof.yaml` entry

## Unsourced authority

Zero tolerance. `check-voice.mjs` counts these separately from soft tells and
they fail the check.

`studies show`, `research shows`, `experts say`, `data shows`, `it is well known`, `widely known`, `widely accepted`, `proven fact`

Two reasons this is not a soft ban. First, most uses are outright false — the
phrase is there to look authoritative without the work of being authoritative.
Second, a professional audience is exactly the audience that checks. Getting
caught doing this once ends the account's credibility in that field.

## Adding to the lists

Edit `scripts/lib/slop.mjs`, then add a line to `CHANGELOG.md`.

Anything added to `HARD_BANS` must be something no reasonable person would say
on purpose. Anything softer goes in `SOFT_TELLS`. If you cannot decide, it is
a soft tell.