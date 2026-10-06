# Playbook 04 — Content calendar

Generates the plan. Does not write posts — `gen-calendar.mjs` decides what and
in what order; `prompts/generate-post.md` writes.

## Preconditions

```bash
node scripts/validate-persona.mjs
```

No blocking gaps. `gen-calendar.mjs` refuses a plan built on an incomplete
persona, because the plan would encode assumptions that the posts then inherit.

Also required:

- `positioning.method` filled
- at least 3 `pov-map.beliefs`
- at least 3 sourced `proof.yaml` entries
- `offers.ladder[].cta_text` filled

## Generate

```bash
node scripts/gen-calendar.mjs --start 2026-01-05 --days 30 --csv --out output/calendar.json
```

Outputs:

- `output/calendar.json` — validated against `schemas/calendar.schema.json`
- `output/calendar.csv` — column order matching `content/calendar.template.csv`
- A console summary: pillar mix against plan, archetype mix, claim levels, and
  any violations

**A non-zero exit means `violations` is non-empty. Fix the plan, not the writing.**
The plan is what encodes the strategy; a post written to compensate for a broken
plan inherits the breakage.

## Read the output

```
LINA CONTENT PLAN  2026-01-05 -> 2026-02-03
persona v0.1.0   slots: 22

PILLAR MIX
  p1  45%  (plan 40%, +5pp)   Diagnostic
  p2  23%  (plan 25%, -2pp)   Method
  p3  14%  (plan 20%, -6pp)   Evidence
  p4   9%  (plan 10%, -1pp)   Position
  p5   9%  (plan  5%, +4pp)   Signal

ARCHETYPE MIX
  18%  how_to (4)
  14%  observation (3)
  ...

CLAIM LEVELS
  level 1 opinion     2
  level 2 observation 9
  level 3 measured    11

PLAN VIOLATIONS
  [WARN] thin_proof: only 2 sourced proof entries available...
```

A 5pp drift on one pillar is rounding from the eligible-date count. A 15pp drift
means the weights do not divide cleanly into the number of posting days — adjust
the weights or the cadence, not the plan by hand.

## Claim levels

| Level | Label | Requires | Means |
|---|---|---|---|
| 1 | opinion | nothing | Asserted and hedged |
| 2 | observation | nothing | From direct work, no hedge |
| 3 | measured | a sourced proof entry | The number is checkable |
| 4 | causal | 2+ refs, tested | A number of any size is fine |

`gen-calendar.mjs` assigns the level from available evidence. Slots with no proof
entry get level 1 or 2, which is why their `specificity` score will be lower.
That is correct. A persona with no evidence produces opinions and methods, and
the rubric says so.

To move slots to level 3, add proof entries. Nothing else raises the ceiling.

## The cadence

Default five posts a week, `identity.publish.allowed_posting_days`. Three is
enough for most personas and better than five for a new one, because it allows
real iteration.

`allowed_posting_times` should reflect when the audience is actually reading,
which means checking analytics at least once — see `07-analytics-review.md`. The
default `08:30 / 12:00 / 17:30` is a starting point, not a finding.

## Overlapping slots

The calendar is a plan, not a schedule. Slots deliberately collide on
`allowed_posting_times`; you pick which one gets which time when you schedule.

## Rolling the calendar

Generate 30 days, fill it, generate the next 30. Do not generate a quarter ahead —
the plan reflects what is known, and after three weeks what is known has changed.

## Adjusting

| Change | Where |
|---|---|
| Mix | `pov-map.pillars[].weight` |
| Post shapes | `brand-consistency.yaml` archetype caps |
| Frequency | `identity.publish.allowed_posting_days`, `max_posts_per_day` |
| Which belief a pillar argues | `pov-map.pillars[].maps_to_beliefs` |
| Which proof a slot may use | `proof.yaml` `usable_in` |
| CTA level | `offers.ladder[].serves`, `primary_archetypes` |

Then regenerate. Never hand-edit `output/calendar.json`; the next run overwrites
it and the hand edits vanish silently.

## Exporting to Sheets

For the Make pipeline, see `integrations/sheets.md` and
`integrations/make.md`. `output/calendar.csv` matches the sheet column order
exactly.