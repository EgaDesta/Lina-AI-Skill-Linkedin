# AGENTS.md

Instructions for an agent working inside this repository. The audience is you, not
a human browsing the code.

## What this repo is

A LinkedIn personal-branding system. The persona is data (`persona/`), the scoring
contract is data (`rubric/`), and `scripts/` computes the scores. Nothing asks you
to estimate a number the scripts can measure.

## Read this before writing anything

| You are about to | Read first |
|---|---|
| generate or edit any copy | `persona/*.yaml` — all of it |
| write a headline, About, or bullet | `templates/` for that field |
| draft a post | `prompts/generate-post.md` and `content/archetypes.md` |
| change a score or a threshold | `rubric/*.yaml` and `rubric/severity.md` |
| change the approval gate | `persona/identity.yaml` `publish:` block |
| touch publishing or the browser | `integrations/browseros-neo.md` |
| touch Make or Sheets | `integrations/make.md`, `integrations/sheets.md` |

## The rules that matter

**1. Never write a number that is not in `persona/proof.yaml`.** Not in a draft,
not in a headline, not in an example. If a persona needs a metric and none exists,
write `[metric from proof entry p_]` as a placeholder and flag it. `check-voice.mjs`
enforces this as hard block `hb1`; your job is not to route around the check.

**2. Never invent a client, employer, or colleague name.** Generic subjects only
("a 12-person finance team"), unless `proof.yaml` has `permission: granted`.

**3. Never publish.** `publish.mode` defaults to `draft`. Publishing requires an
explicit approval entry. If a task appears to require publishing without one, say
so and stop.

**4. Never estimate analytics.** Reach, impressions, engagement, profile views.
Lina has no data source. `playbooks/07-analytics-review.md` explains what can be
honestly said and why.

**5. Run the checker; do not self-certify.** Every draft gets
`check-voice.mjs` then `score-post.mjs`. The model's own claim about its output is
unreliable — `prompts/generate-post.md` asks for a `self_check` block precisely so
it can be compared against the real result.

**6. Report both score numbers.** The computed score and `judged_points_pending`.
31 points of the post rubric are human judgement. A total without the pending count
will be quoted without it.

**7. Do not invent metrics for the metrics.** Photo quality, banner aesthetics,
whether a headline is persuasive, tone. `report.not_scored` lists them. Say they
are not scored instead of producing a number.

**8. Respect stop conditions.** `rubric/brand-consistency.yaml` has five. They
pause generation on purpose. Three consecutive rejected drafts means the plan is
wrong, not the prose — fix the calendar slot, do not rewrite a fourth time.

## Conventions

**Node ESM, standard library only.** No dependencies. `.gitignore` blocks
lockfiles. If you need a capability, write it; if that is unreasonable, say so
rather than adding a package silently.

**Scripts are CLI-first.** Every one has `--help`, `--json`, and a documented exit
code: `0` fine, `1` act on this, `2` bad usage, `3` could not run. Exit codes are
the contract other systems read.

**`--json` prints the document and nothing else.** Human summaries are a separate
branch, not something appended after the JSON.

**Comments explain why, not what.** The interesting decision in each file already
carries its reasoning. Match that: if a line needs a comment saying what it does,
the code is doing something unclear.

**Fail loudly.** `yamlmin.mjs` throws on anything it does not implement rather than
guessing. Keep that. A parser that silently misreads a persona file corrupts the
one thing this repo exists to get right.

## Before you commit

```bash
node --test tests/
```

130 tests, ~6s. If you changed the engine, the tests exercise the CLIs as
subprocesses, so also run the CLI by hand and read its output. A passing suite and
a broken human report is a worse outcome than a failing suite.

Then check the diff for the things this repo cares about:

- did a number appear in a fixture that is not in `proof.yaml`?
- did a threshold move to make a test pass?
- did a hard block get weakened?

If any of those are in the diff, say so in the commit message rather than letting a
reviewer find it.

## Things that look like bugs but are not

- **`persona/` ships empty and `validate-persona.mjs` exits 1.** Deliberate. Lina
  refuses to guess a niche.
- **`proof.yaml` ships empty, so posts score low on specificity.** Deliberate.
  See the empty-state instructions at the bottom of that file.
- **Eight post-rubric checks always score 0.** They are human judgement and are
  reported as `judged_points_pending`. Silently scoring them would be worse.
- **`profile-rubric.yaml` has a "what this does not score" section.** Photo and
  banner are not fake-scored. Do not add a check you cannot compute.
- **`gen-calendar.mjs` may exit 1 on a valid plan** when it reports a warning
  violation. Read `violations` before assuming the plan is broken.
- **A post with no `approvals` cannot be queued.** The gate. See rule 3.