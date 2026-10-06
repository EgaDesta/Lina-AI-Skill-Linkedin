# Playbook 05 — Post compose

The path from a calendar slot to an approved post. Publishing is the one
irreversible action in this repo, and the gate is the point of the whole system.

## Status flow

```
planned -> drafted -> scored -> in_review -> approved -> queued -> published
                  \                  \
                   -> draft (failed)  -> rejected
```

`score-post.mjs --write` sets `scored`, `in_review`, or `rejected` from the score
and the hard blocks. It never sets `queued` or `published`.

## Step 1 — Claim the slot

```bash
# find the next planned slot
node -e "const c=require('./output/calendar.json'); console.log(JSON.stringify(c.slots.find(s=>s.status==='planned'),null,2))"
```

Move it to `drafted` when writing starts.

## Step 2 — Write

`prompts/generate-post.md` with the slot, the persona, and the last 30 published
posts in context.

Output to `output/drafts/<slot-id>.json`, matching `schemas/post.schema.json`.

Non-negotiable in the draft:

- Every number exists in `proof.yaml` with a tier and a source
- No client, employer, or colleague named without `permission: granted`
- `status: "draft"`
- `proof_refs` populated from the slot, not invented

## Step 3 — Check

```bash
node scripts/check-voice.mjs --file output/drafts/<slot-id>.json
node scripts/score-post.mjs --file output/drafts/<slot-id>.json --history output/published.jsonl --write
```

Always both. The draft's `self_check` is a useful signal, not evidence — it is
the model's own claim about its own output, and it is wrong often enough to be
unreliable.

## Step 4 — Read the score honestly

`score-post.mjs` reports two numbers:

- **`total`** — the computed score scaled to 100
- **`judged_points_pending`** — points attached to checks no script can measure

Eight checks are human judgement and carry 31 points. So a `total` of 62 means
different things depending on what is pending. Read `measures` and the
`not_scored` list before acting.

| Band | Score | Action |
|---|---|---|
| `reject` | 0–59 | Rewrite. Do not queue. `prompts/rewrite-post.md`. |
| `revise` | 60–74 | Fix the lowest dimension, re-run. |
| `approve` | 75–89 | Eligible for the approval queue. |
| `strong` | 90–100 | Eligible. Note the pillar for next month's analytics review. |

## Step 5 — Rewrite, at most three times

`prompts/rewrite-post.md`. Maximum three rounds.

Three consecutive rejects trips `brand-consistency.yaml` stop condition
`sc_stop_2`: the plan is wrong, not the prose. Go back to
`playbooks/04-content-calendar.md` and change the slot's archetype, claim level,
or pillar. A fourth rewrite of the same slot wastes the slot.

Record `revision.round` and `revision.changed` with each pass.

## Step 6 — Hard blocks

`rubric/post-rubric.yaml` `hard_blocks`, and `sc_stop_5`. Not score-dependent.
A draft with any hard block is rejected regardless of total.

| Block | Cause | Fix |
|---|---|---|
| `hb1` | number not in `proof.yaml` | add the entry with tier and source, or remove the number |
| `hb2` | client named, permission not granted | genericise the subject |
| `hb3` | AI self-reference | `voice.banned_patterns` — cut it |
| `hb4` | stale proof in present tense | reframe historically or drop it |
| `hb5` | published without the gate | restore `status` |
| `hb6` | `queued`/`published` with no approval | requires `approval_required: false` explicitly |

## Step 7 — Human review

The script cannot judge 31 points. A human reads the draft against:

- `not_scored` from the report — all 8 items, explicitly
- The persona's `belief_refs`: is this what the persona actually argues?
- `archetype` structure from `content/archetypes.md`: does the post follow the shape?
- One question: would I send this to someone I want to impress?

Then set the status by hand, or export for approval.

## Step 8 — Approval

`publish.approval_required: true` by default. Approval is recorded:

```json
"approvals": [
  {
    "decision": "approved",
    "at": "2026-01-06T09:14:00Z",
    "by": "human",
    "note": "read twice, numbers check out"
  }
]
```

Four decisions: `approved`, `rejected`, `edited`, `held`.
- `edited` carries the new text in `edited_text`. This is the usual one, and it
  is the most valuable: the human's edit becomes part of `voice-samples.md`.
- `held` parks it with a reason.

`score-post.mjs` `hb6` fails any post at `queued` or `published` without an
approved entry, unless `publish.approval_required` is explicitly `false`.

**Approved in batches of `approval_batch_size` (default 5).** Not one at a time:
reviewing 22 posts individually is the step that gets abandoned, and an abandoned
review is worse than a batch review.

## Step 9 — Publish

Only from `approved`.

`publish.mode`:

| Mode | Behaviour |
|---|---|
| `draft` | Posts stop at `in_review`. Nothing leaves the repo. **Default.** |
| `queue` | Approved posts exported for the Make pipeline. Still not published. |
| `auto` | Published. Requires `approval_required: false` and a per-batch human confirm. |

`validate-persona.mjs` blocks `auto` without a timezone and blocks it entirely
while blocking persona gaps remain. This is not advisory.

Route: `integrations/make.md` for the pipeline, `integrations/browseros-neo.md`
for direct.

## Step 10 — Record

Update `slot.status` to `published` with `published_url` in
`output/calendar.json`, and append the post to `output/published.jsonl` — one
JSON object per line, with `text`. That file is the repetition reference for
`--history` and the drift reference for `check-voice.mjs --drift`. Without it,
hook reuse and 4-gram overlap are not detected at all.

## Step 11 — Measure

After 24h and 7d, fill `post.metrics` from LinkedIn analytics. Only from
analytics. Never estimated — see `rubric/severity.md`.

---

## Never

- Publish from `status: scored`. The score is a machine's opinion.
- Let `approval_required` be flipped to make a batch go faster.
- Publish a number that entered the draft by accident. The check exists and it is
  the whole value of the system.
- Post the same slot twice because the first one is still in draft.