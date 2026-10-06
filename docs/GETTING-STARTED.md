# Getting started

A walkthrough with real captured output for each of the six commands, so you know
what to expect before running anything. Every block below is actual output from
this repo.

Requirements: **Node 18+**. Nothing else — no install, no build, no dependencies.

```bash
node --version
```

---

## 1. See what is missing

```bash
node scripts/validate-persona.mjs
```

On a fresh clone `persona/*.yaml` is empty, so this exits 1:

```
========================================================================
LINA PERSONA VALIDATION
========================================================================

20 gap(s) found, 14 blocking.

BLOCKING — Lina cannot generate until these are filled
  x persona/identity.yaml
      profile.display_name: the human name Lina writes as
  x persona/identity.yaml
      profile.role_title: the role title that goes in the headline
  x persona/identity.yaml
      profile.domain: the primary niche slug
  ...

NON-BLOCKING — will reduce scores until filled
  - persona/proof.yaml
      proof.entries: at least 3 filled entries needed for the specificity
      dimension; found 0
  ...
```

**That is correct, not broken.** Lina will not guess your niche, your positioning
line, or what you sell. A guessed persona produces generic output, and a generic
personal brand is worse than none.

Exit code `1` means "gaps found". `3` would mean the persona could not be loaded.

## 2. Start from the worked example

```bash
cp data/examples/sample-persona/*.yaml persona/
```

On Windows:

```powershell
copy data\examples\sample-persona\*.yaml persona\
```

That gives you a complete operations-automation persona — every field filled,
three voice samples, five sourced proof entries — so you can see what a finished
one looks like before writing your own.

Then edit. Start with `persona/identity.yaml` and `persona/audience.yaml`:
everything else inherits from them. `docs/FILL-CHECKLIST.md` has the order.

## 3. Check again

```bash
node scripts/validate-persona.mjs
```

On the example persona:

```
========================================================================
LINA PERSONA VALIDATION
========================================================================

All required persona fields are filled.

VOICE MEASURED FROM SAMPLES
  3 samples  mean sentence 12.4 words  variance 0.51  emoji/post 0  hashtags/post 3
```

The voice line is measured from `persona/voice-samples.md`, not asserted. If your
real posts disagree with `voice.yaml`, it says so — and where they disagree, the
samples win:

```
  [WARN] voice.mean_sentence_words
      voice.yaml target is 9 words, samples average 12.4 (38% off). Where samples
      and config disagree, the samples win — update voice.yaml.
```

## 4. Audit a profile

```bash
node scripts/score-profile.mjs --file data/examples/sample-profile.json
```

That file is a deliberately bad profile. Real output:

```
========================================================================
LINA PROFILE AUDIT
subject: 412837465
persona: v0.1.0
========================================================================
SCORE  10 (capped) / 100   band: not_ready
CAP    blocking checks failed: pc1, pc2, ps1, ps4, sc1, cm3, cv2, pcx1.
       Total capped at 59 regardless of other points.

DIMENSIONS
  Positioning clarity        0/22      0%    ...
      Can a stranger say what Lina does after 10 seconds?
  Proof and specificity      0/18      0%    ...
      Is any claim checkable?
  ...

BLOCKERS
  [BLOCKER] ps1  At least 3 quantified outcomes  (5 pts)
         measured 1 distinct numeric outcomes in profile copy   target >=3
         fix: Add numbers to three places: one in About, one in the current
              role, one in Featured. Unnumbered claims read as unverified.  [medium]

  [BLOCKER] pc1  Headline contains role title  (4 pts)
         measured "Experienced Consultant"   target a role title from persona
         fix: Open the headline with the role title buyers search for.  [trivial]
         from: templates/headline.formulas.md
  ...

DO THESE THREE FIRST
  1. [blocker] Add numbers to three places: one in About, one in the current
     role, one in Featured. Unnumbered claims read as unverified.  (5 pts)
  2. [blocker] Open the headline with the role title buyers search for.  (4 pts)
  3. [blocker] Put the primary keyword in the headline. It is the only field
     that reliably appears in LinkedIn search.  (4 pts)
```

How to read it:

- **`(capped)`** — a blocker failed, so the total is held at 59 no matter how well
  everything else scores. You cannot be `strong` while missing the thing that
  makes you findable.
- **`...` / `....` / `.....`** — how much of that dimension you scored.
- **`[trivial]` / `[low]` / `[medium]`** — how much work the fix is.
- **`needs human`** — no script can decide this one; a person has to.
- **`NOT SCORED`** at the end lists what the report deliberately refuses to
  judge: photo, banner, whether the headline is actually persuasive. Read it, do
  not fill it with an opinion.

To audit a real profile, write a JSON export first. Shape:
`data/examples/sample-profile.json`. `playbooks/02-audit.md` has the field list
and `integrations/browseros-neo.md` has the browser recipe.

```bash
node scripts/score-profile.mjs --file data/examples/sample-profile.json --out output/reports/audit.json
```

## 5. Plan content

```bash
node scripts/gen-calendar.mjs --start 2026-01-05 --days 30 --csv
```

```
LINA CONTENT PLAN  2026-01-05 -> 2026-02-03
persona v0.1.0   slots: 22

PILLAR MIX
  p1   50%  (plan 40%, +10pp)  Diagnostic
  p2   32%  (plan 25%, +7pp)   Method
  p3    9%  (plan 20%, -11pp)  Evidence
  p4    5%  (plan 10%, -5pp)   Position
  p5    5%  (plan  5%, 0pp)    Signal

ARCHETYPE MIX
   14%  how_to (3)
   14%  framework (3)
    9%  observation (2)
    9%  checklist (2)
   ...

CLAIM LEVELS
  level 1 opinion     4
  level 3 measured    16
  level 4 causal      2

Plan satisfies rubric/brand-consistency.yaml.
```

This is a **plan, not posts**. It decides what to publish, in what order, drawing
on what evidence exists. Slots with no proof entry plan at a lower claim level, and
say so — a persona with no evidence produces opinions and methods, and the rubric
reflects that honestly.

If it prints `PLAN VIOLATIONS`, the plan is wrong, not the writing. Fix
`pov-map.pillars[].weight` and regenerate. Do not hand-edit the output; the next
run overwrites it.

`--json` prints the plan document and nothing else, for scripts.

## 6. Score a draft

Save a draft to `output/drafts/<id>.json` in the shape of
`schemas/post.schema.json`, then:

```bash
node scripts/check-voice.mjs --file output/drafts/post-1.json
node scripts/score-post.mjs --file output/drafts/post-1.json
```

On a post with invented numbers — `data/examples/sample-post-bad.json`:

```
========================================================================
LINA POST AUDIT
subject: sample-post-bad-post
persona: v0.1.0
========================================================================
SCORE  0 / 100   band: reject

HARD BLOCKS — this is rejected regardless of score
  [HARD] hb1  Unsourced factual claim
         "47" — not in proof.yaml. In: "Studies show that most teams can cut
                costs by 47% and improve productivity by 38%..."
         "38" — not in proof.yaml. In: "Studies show that most teams can cut
                costs by 47% and improve productivity by 38%..."
         "73" — not in proof.yaml. In: "Like and share if this resonates!
                DM me for more information about cutting your costs by 73%..."
         "61" — not in proof.yaml. In: "..."
         fix: Add each result to persona/proof.yaml with a tier and a source,
              or remove the number from the post.  [low]
```

Four invented numbers, each named with the sentence it came from. **This is the
feature.** A model asked for a case study will write "cut processing time by 40%"
because that is what a case study looks like; this is where that gets caught.

`WARNINGS` and `BLOCKERS` follow, then:

```
DO THESE THREE FIRST
  ...

NOT SCORED (human judgement)
  - Whether line 1 is specific rather than generic (h3)
  - Whether the post contains a concrete artefact (s1)
  ...

computed 61% of 69 points
31 points pending human judgement (listed under NOT SCORED)
```

**Read the last two lines.** 31 of the 100 points are human judgement and score 0
until someone decides. A total without that caveat will be quoted without it.

`--write` puts the score and status back into the file, moving it to `in_review`
at or above `identity.publish.min_post_score` (default 75), or back to `draft` /
`rejected`. It never sets `queued` or `published`.

```bash
node scripts/score-post.mjs --file output/drafts/post-1.json --write
```

## 7. Export for Make

```bash
node scripts/export-queue.mjs --out output/queue.csv
```

Exports only posts at `status: "approved"` with a real approval record and no hard
blocks. Everything else is refused, with the reason:

```
scanned : 12 post(s) in output/drafts
exported: 3
blocked : 9

BLOCKED
  slot-2026-01-08-004: status is "in_review", not "approved"
  slot-2026-01-08-006: score 68 is below identity.publish.min_post_score 75
  slot-2026-01-09-002: publish.approval_required is true but no approved entry in approvals
```

Then `integrations/make.md` for the pipeline, `integrations/sheets.md` for the
column order. Make never generates copy — a generator there has no access to the
proof registry.

---

## The loop

```
validate-persona  ->  score-profile  ->  gen-calendar
                                          |
                                          v
                            draft  ->  check-voice  ->  score-post
                                                          |
                                        score < 75 -----+
                                                          |
                                        human approves --+
                                                          |
                                                          v
                                     export-queue  ->  Make  ->  LinkedIn
```

Publishing stops at approval. `identity.publish.mode` defaults to `draft`;
`approval_required` defaults to `true`. Setting `auto` requires flipping
`approval_required` to `false` explicitly, and still expects a human confirm per
batch.

---

## Every command

| Command | Does |
|---|---|
| `validate-persona.mjs` | completeness, cross-references, gate sanity, voice measurement |
| `score-profile.mjs` | profile audit, score, findings by severity, top three fixes |
| `score-post.mjs` | draft score, hard blocks, measures, pending-judgement count |
| `check-voice.mjs` | hard bans, soft tells, proof sourcing, optional drift |
| `gen-calendar.mjs` | pillar × archetype × claim level → dated plan |
| `export-queue.mjs` | approved posts → CSV for Make |

All take `--help` and `--json`. Exit codes: `0` fine, `1` act on this, `2` bad
usage, `3` could not run.

```bash
node scripts/score-post.mjs --help
```

## Reading the rubrics directly

The rubrics are readable YAML if you want to know what is being measured:

- `rubric/profile-rubric.yaml` — 100 points, 7 dimensions, 21 checks
- `rubric/post-rubric.yaml` — 100 points, 5 hard blocks, grade bands
- `rubric/brand-consistency.yaml` — drift thresholds, claim ladder, stop conditions
- `rubric/severity.md` — what blocker/warn/nice mean, and why the caps exist

`profile-rubric.yaml` ends with a section on what it deliberately does not score.
Read it before adding a check you cannot compute.

## Running the tests

```bash
node --test tests/
```

133 tests, ~6s. They run the CLIs as subprocesses, so they cover argument parsing,
exit codes and JSON output, not just the library functions.