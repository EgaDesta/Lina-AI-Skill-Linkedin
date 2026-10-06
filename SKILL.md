---
name: lina-linked-persona
description: "Build, optimize, and audit a LinkedIn profile with a written persona and personal-brand logic, then generate and score posts against it. Use for LinkedIn positioning, headline/About copy, profile audits, content planning, or post drafting."
---

# Lina — LinkedIn persona

Lina holds a LinkedIn persona as **data**, and every score as a **computation**.

She is not a prompt. `persona/*.yaml` is the persona; `rubric/*.yaml` is the
scoring contract; `scripts/*.mjs` do the arithmetic. You read the persona, call the
scripts, and report what they say. You never estimate a number Lina can measure.

## The one rule

**Never state a number that is not in `persona/proof.yaml` with a tier and a
source.** `check-voice.mjs` blocks any draft that breaks this, and
`rubric/post-rubric.yaml` hard block `hb1` rejects it regardless of score.

This is the whole point of the repo. A synthetic persona's most damaging move is
manufacturing a plausible result. If the persona has no proof, write process
content or hedged opinion — `proof.yaml` ends with instructions for exactly this
case, and lower specificity scores are the correct output, not a bug to route
around.

## Pick a mode

| The user wants | Read | Then run |
|---|---|---|
| A profile from nothing | `playbooks/01-build-from-zero.md` | `validate-persona.mjs` |
| An audit of an existing profile | `playbooks/02-audit.md` | `score-profile.mjs` |
| Specific fields rewritten | `playbooks/03-optimize.md` | `score-profile.mjs` |
| A content plan | `playbooks/04-content-calendar.md` | `gen-calendar.mjs` |
| Posts written and scored | `playbooks/05-post-compose.md` | `check-voice.mjs` then `score-post.mjs` |
| Comments, DMs, connections | `playbooks/06-engagement.md` | — |
| Which content is working | `playbooks/07-analytics-review.md` | `check-voice.mjs --drift` |
| Copy for a single field | `templates/` | — |

Read the playbook before doing the work. The orderings in them are the reasoning;
skipping one produces output that has to be redone.

## Commands

Run from the repo root. Exit codes are the contract: `0` fine, `1` problems to
act on, `2` bad usage, `3` could not run.

```bash
node scripts/validate-persona.mjs [--json]

node scripts/score-profile.mjs --file data/examples/<slug>.json
                                 [--json] [--min 60] [--out PATH]

node scripts/score-post.mjs --file output/drafts/<id>.json
                             [--text "..."] [--history output/published.jsonl]
                             [--json] [--write]

node scripts/check-voice.mjs --file <path> [--drift] [--history PATH] [--json]

node scripts/gen-calendar.mjs --start YYYY-MM-DD --days 30 [--csv] [--out PATH] [--json]

node scripts/export-queue.mjs --out output/queue.csv [--json]
```

Every script has `--help` and `--json`.

## Before anything else

```bash
node scripts/validate-persona.mjs
```

An unfilled persona reports blocking gaps and exits 1. This is deliberate:
Lina will not guess a niche, a positioning line, or an offer. Fill
`persona/*.yaml` first, or copy the worked example and adapt it:

```bash
cp data/examples/sample-persona/*.yaml persona/
```

Then edit. The example is a complete operations-automation persona — every field
filled, three voice samples, five sourced proof entries.

## The shape of the work

1. **`validate-persona.mjs`** — no blocking gaps, or stop and report the gaps.
2. **Read the playbook** for the mode.
3. **Read the persona files** the playbook names. All of `persona/*.yaml` for
   writing anything; specific files for specific fields.
4. **Generate** copy using `prompts/*.md` as the runtime instruction.
5. **Run the checker.** Always. Never trust the copy's own claims about itself —
   `prompts/generate-post.md` asks the model to self-check, and that check is
   wrong often enough to be unusable as evidence.
6. **Report** the score, the findings by severity, and the top three fixes.
7. **Never publish.** `identity.publish.mode` defaults to `draft`. Publishing
   requires an explicit approval record; see `playbooks/05-post-compose.md`.

## Reporting scores honestly

Two numbers, always both:

- the **computed score**, from checks a script can measure
- **`judged_points_pending`**, points attached to human judgement

Eight post-rubric checks are human-only and score 0 until someone decides. A total
of 62 means something different depending on what is pending, so reporting one
number without the other is misleading. The scripts print both; pass both on.

The profile rubric refuses to score photo, banner, and whether a headline is
actually persuasive. Do not fill that gap with an opinion. A fake score is worse
than an honest omission, and `report.not_scored` lists the gaps so you can state
them.

## What not to do

- **Publish.** Not without an explicit approval entry, and never from `auto` mode
  that someone enabled without saying so.
- **Invent evidence.** No number, no client name, no credential. `proof.yaml`
  is the registry and it is short on purpose.
- **Estimate analytics.** Reach, impressions, engagement. Lina has no data
  source. Say she cannot know; `07-analytics-review.md` explains the honest
  version.
- **Ignore a stop condition.** `rubric/brand-consistency.yaml` has five. They
  pause generation deliberately — three consecutive rejected drafts means the
  plan is wrong, not the prose.
- **Regenerate to fix a score.** `prompts/rewrite-post.md` preserves what already
  worked. A rewrite that discards the working parts means the next version loses
  them too.
- **Hand-edit generated files.** `output/calendar.json` and `output/queue.csv`
  are derived. The next run overwrites them.
- **Score something unmeasurable.** If no check covers it, it is a human review
  step in a playbook, not a number.

## Multiple personas

`LINA_PERSONA_ROOT` points the scripts at an alternate persona directory. Useful
for running a second brand from one install, and it is how the tests exercise the
engine against a filled fixture.

```bash
LINA_PERSONA_ROOT=path/to/other-persona node scripts/score-post.mjs --file draft.json
```

The directory may be a repo root containing `persona/`, or a directory holding
`identity.yaml` and its siblings directly.