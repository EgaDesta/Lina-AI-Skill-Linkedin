# Lina — LinkedIn persona skill

A personal-branding system for LinkedIn where **the persona is data** and **every
score is computed**.

Lina does not ask you to trust a prompt. The positioning, the audience, the voice,
the beliefs, the proof and the offers live in YAML you edit. The rubrics live in
YAML too, and the scores come from scripts. If a claim in this repo says a post
scores 74, something measured it.

It builds a profile from zero, audits an existing one, rewrites individual
fields, plans a month of content, drafts posts, scores them, and holds everything
behind an approval gate.

**Node 18+. No dependencies. No install step. No build.**

```bash
node scripts/validate-persona.mjs
```

---

## Why it works this way

Three decisions shape everything else.

**Proof is a gate, not a suggestion.** `persona/proof.yaml` is the registry of
every claimable number, each with a verification tier and a source. `check-voice.mjs`
blocks any draft whose numbers are not in there. A post with an unsourced result
is rejected whatever its other qualities.

The reason is not squeamishness. The single most damaging thing a synthetic
personal brand can do is manufacture a convincing result, and it is easy to do by
accident — a model asked for a case study will write "cut processing time by 40%"
because that is what a case study looks like. Refusing to invent is the product.

With no proof yet, the honest strategy is to publish process content: the method,
the sequence, where it usually breaks. That scores lower on specificity. That is
correct behaviour, and `proof.yaml` ends with instructions for exactly this case.

**Scores are computed, or they are not given.** Every check in the rubrics names a
condition a script can measure — character counts, sentence-length variance,
digits per bullet, 4-gram overlap against the last 30 posts, pronoun ratios. What
cannot be measured is deliberately left out and listed under `not_scored`: photo
quality, banner aesthetics, whether a headline is actually persuasive. A rubric
that scores those is lying about its precision.

**Judgement is named, not hidden.** Eight post-rubric checks need a human. They
score 0 until someone decides, and `score-post.mjs` reports the pending count
beside the score. A total without it is a number designed to be quoted out of
context.

---

## Install

```bash
git clone https://github.com/egadestaviano/lina-linked-persona.git
cd lina-linked-persona
node scripts/validate-persona.mjs
```

Clone it wherever you like. There is nothing to build.

**As an agent skill**, link the repo into your skills directory so `SKILL.md` is
discovered:

```bash
# Claude Code / opencode style skill dirs
ln -s /path/to/lina-linked-persona ~/.claude/skills/lina-linked-persona
```

`SKILL.md` is the router: it maps a request to a playbook and a command, and states
the rules an agent must not break.

---

## Five minutes

```bash
# 1. What is missing? (An unfilled persona reports gaps and exits 1 — by design.)
node scripts/validate-persona.mjs

# 2. Start from the worked example, then edit it into your niche
cp data/examples/sample-persona/*.yaml persona/

# 3. Check again
node scripts/validate-persona.mjs
node scripts/validate-persona.mjs --json    # for the machine path

# 4. Audit a real profile export
node scripts/score-profile.mjs --file data/examples/sample-profile.json
```

That last command scores the deliberately bad sample at **23/100**, capped because
a blocker failed, with the first three fixes printed. It is the fastest way to see
what a report looks like.

---

## The persona

`persona/*.yaml` ships empty. Lina will not guess your niche, your positioning
line, or what you sell — an empty persona produces a generic one, and a generic
personal brand is worse than none.

| File | Holds | Fill it when |
|---|---|---|
| `identity.yaml` | who Lina writes as, positioning, the publish gate | first |
| `audience.yaml` | three segments: roles, pains, failed attempts, objections | first |
| `pov-map.yaml` | beliefs, hot takes, anti-positions, content pillars | second |
| `proof.yaml` | every number, with tier and source | ongoing, honestly |
| `offers.yaml` | the offer ladder and CTA policy | second |
| `keywords.yaml` | primary plus three secondary, phrase bank, hashtags | second |
| `voice.yaml` | tone, sentence shape, vocabulary, banned patterns | second |
| `voice-samples.md` | 3+ real posts, the ground truth for voice | third |

Start with `identity.yaml` and `audience.yaml`. Everything else inherits from them.

### The one that matters most

```yaml
positioning:
  statement: "I help {audience} achieve {outcome} through {method}."
  problem: ""        # the painful thing, in their words
  method: ""         # a NAMED approach. "The 3-Step X". A vague method is
                     # the single biggest cause of forgettable presence.
  differentiator: "" # why you over the obvious alternative
```

The method needs a name because a nameless method cannot be referred to, quoted,
or searched for. If you cannot name yours yet, that is the work, and
`validate-persona.mjs` will not let you skip it.

### Voice samples are the honest source

`voice.yaml` is a set of numbers about how you write. `voice-samples.md` is proof
you do. `validate-persona.mjs` measures the samples and reports where they disagree
with the config:

```
VOICE MEASURED FROM SAMPLES
  3 samples  mean sentence 12.4 words  variance 0.51  emoji/post 0  hashtags/post 3
[WARN] voice.mean_sentence_words
    voice.yaml target is 9 words, samples average 12.4 (38% off). Where samples
    and config disagree, the samples win — update voice.yaml.
```

Where they disagree, the samples win. Write three posts the way you would write
them if nobody were measuring, paste them in, then fix the config to match.

---

## What the rubrics measure

### Profile — 100 points

| Dimension | Pts | Asks |
|---|---|---|
| Positioning clarity | 22 | Can a stranger say what you do after 10 seconds? |
| Proof and specificity | 18 | Is any claim checkable? |
| Search coverage | 14 | Do you surface when a buyer searches the problem? |
| Completeness | 14 | Is anything structurally missing? |
| Readability | 10 | Does it survive a mobile scan? |
| Conversion path | 12 | If they liked it, is there an obvious next step? |
| Persona consistency | 10 | Does the profile sound like the posts? |

Bands: `not_ready` 0–39, `needs_work` 40–59, `workable` 60–79, `strong` 80–92,
`category_leader` 93–100.

A blocker caps the total at 59. You cannot be `strong` while missing the thing
that makes you findable.

### Post — 100 points

Hook 20 · Specificity 20 · Structure 15 · Value density 15 · Voice match 15 ·
CTA 10 · Format fit 5.

31 points are human judgement and are reported as pending.

### Five hard blocks

Independent of score. A draft with any of them is rejected:

| | Block | Why |
|---|---|---|
| hb1 | unsourced factual claim | Lina must not manufacture results |
| hb2 | client named without permission | confidentiality |
| hb3 | AI self-reference | a professional audience can tell |
| hb4 | stale proof in present tense | decay is worse than omission |
| hb5 | published outside the approval gate | `approval_required` bypassed |

---

## The approval gate

Default `publish.mode: draft`. Nothing leaves the repo.

The gate is enforced in four places, deliberately redundant:

1. `schemas/post.schema.json` rejects a `queued` post with no approval record
2. `score-post.mjs` raises `hb5`/`hb6`
3. `export-queue.mjs` refuses to export it
4. `validate-persona.mjs` blocks `auto` without a timezone, or while blocking gaps remain

Setting `mode: auto` requires flipping `approval_required` to `false`
explicitly — and still expects a human confirm per batch.

This is the one irreversible action in the repo, and the reason the gate exists in
four places is that a single one is one careless edit away from being bypassed.

---

## Make.com and Sheets

```
Lina ──► output/queue.csv ──► Google Sheets ──► Make ──► LinkedIn
            (approved only)     (add image_url)   (image,  (ShareImage)
                                                   publish, write back)
```

- `integrations/make.md` — scenario, idempotency, what Make must not do
- `integrations/sheets.md` — column order, status vocabulary, the one rule about
  not filtering on score
- `integrations/browseros-neo.md` — browser recipes, including the contenteditable
  trap in LinkedIn's About editor

**Make never generates copy.** A generator inside Make has no access to the proof
registry, so it will produce plausible numbers with no sources, which is the exact
failure this repo exists to prevent.

`output/queue.csv` matches `content/calendar.template.csv` column for column. Do
not reorder it; the scenario maps by name.

---

## Layout

```
persona/       8 files. The persona. Ships empty, on purpose.
rubric/        profile, post, brand-consistency, severity
scripts/       6 CLIs + 6 libs. Standard library only.
content/       pillars, 10 archetypes, 10 hook families, CTA library,
               slop blacklist, format specs, calendar template
playbooks/     7 workflows, empty profile through analytics review
prompts/       5 runtime prompts
templates/     8 formula files for profile copy
schemas/       JSON Schema: persona, post, audit report, calendar
integrations/  Make, Sheets, BrowserOS neo
data/examples/ a filled persona + good/bad post + weak profile fixtures
tests/         130 tests
output/        generated. gitignored.
```

---

## Scripts

| Command | Does |
|---|---|
| `validate-persona.mjs` | completeness, cross-references, publish-gate sanity, voice measurement |
| `score-profile.mjs` | profile audit → score, findings by severity, top three fixes |
| `score-post.mjs` | draft → score, hard blocks, measures, pending-judgement count |
| `check-voice.mjs` | hard bans, soft tells, proof sourcing, optional drift over history |
| `gen-calendar.mjs` | pillar × archetype × claim level → dated plan, with violations |
| `export-queue.mjs` | approved posts → CSV for Make |

All take `--json`. All take `--help`. Exit `0` fine, `1` act on this, `2` bad
usage, `3` could not run.

A sample run:

```
========================================================================
LINA POST AUDIT
subject: slot-2026-01-08-001
========================================================================
SCORE  0 / 100   band: reject

HARD BLOCKS — this is rejected regardless of score
  [HARD] hb1  Unsourced factual claim
         "40%" — not in proof.yaml. In: "cut processing time by 40%..."
         fix: Add each result to persona/proof.yaml with a tier and a source,
              or remove the number from the post.  [low]
```

Read the last two lines of any post report: the computed percentage, and how many
points are pending human judgement. A total quoted without them is misleading.

---

## Documentation

| File | For |
|---|---|
| `docs/GETTING-STARTED.md` | a walkthrough with real captured output for all six commands |
| `docs/FILL-CHECKLIST.md` | which persona fields to fill, in dependency order, and what each unlocks |
| `SKILL.md` | the agent router, if you are wiring this into an agent |
| `AGENTS.md` | conventions, and what looks broken but is not |

---

## Development

```bash
node --test tests/          # 130 tests, ~6s
```

Tests run the CLIs as subprocesses against `data/examples/sample-persona`, so they
cover argument parsing, exit codes and JSON output, not just the library functions.

No dependencies, and `.gitignore` blocks lockfiles on purpose. A lockfile
appearing means someone added a package to something that does not need one.

`scripts/lib/yamlmin.mjs` is a ~250-line YAML subset parser that throws on
anything it does not implement rather than guessing. It exists because the persona
files have to stay hand-editable and the repo has to run anywhere Node runs.

---

## Extending

- **New rubric check** — add it to `rubric/*.yaml` with a computable condition,
  implement it in the matching script, add a test. If you cannot compute it, it
  belongs in a playbook, not in the score.
- **New archetype** — add to `content/archetypes.md`, the schema enum, and the
  order list in `gen-calendar.mjs`.
- **New hard-ban phrase** — `scripts/lib/slop.mjs`, then `CHANGELOG.md`.
- **Per-brand personas** — `LINA_PERSONA_ROOT`.

---

## License

MIT.