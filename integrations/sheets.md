# Google Sheets queue

The handoff table between Lina and the Make pipeline. The column order matches
`content/calendar.template.csv` exactly, so the same file works in both places
without transformation.

## Column order

Never reorder. `integrations/make.md` maps Make modules onto these by name, and
reordering breaks the scenario silently — a header moves, the module reads the
wrong cell, and a post publishes with someone else's body.

```
id, date, time, pillar, segment, archetype, belief_refs, proof_refs,
offer_rung, hook_family, hook_brief, claim_level, status,
title, body, image_brief, image_url,
visibility, feed_distribution, score,
approvals, published_at, published_url, notes
```

| Column | Source | Notes |
|---|---|---|
| `id` | post id | join key. The only identifier that matters. |
| `date` | slot | `YYYY-MM-DD` |
| `time` | slot | `HH:MM` local, from `allowed_posting_times` |
| `pillar` | slot | `p1`–`p5` |
| `segment` | slot | audience segment id |
| `archetype` | slot | one of ten |
| `belief_refs` | slot | space-separated |
| `proof_refs` | slot | space-separated. Empty means claim level 1–2. |
| `offer_rung` | slot | 1–5 |
| `hook_family` | slot | one of ten from `content/hooks.md` |
| `hook_brief` | slot | the instruction the post was written against |
| `claim_level` | slot | 1–4 from `claim_ladder` |
| `status` | workflow | `Planned` → `Drafted` → `Scored` → `Approved` → `Posted`. The Make filter is `Approved`. |
| `title` | draft | max 60 chars. Also the image prompt seed. |
| `body` | draft | `post.text`. Never edited outside Lina. |
| `image_brief` | slot or form | `content/formats.md`. Optional. |
| `image_url` | Make | filled by Make |
| `visibility` | `allowed_visibility` | never a per-post decision |
| `feed_distribution` | `allowed_feed_distribution` | never a per-post decision |
| `score` | `score-post.mjs` | for sorting. Not for filtering — see below. |
| `approvals` | approval step | JSON array. Proves the gate. |
| `published_at` | Make | `YYYY-MM-DDTHH:MM:SSZ` |
| `published_url` | Make | the real URL, verified |
| `notes` | either | human notes. Make must not write here. |

## Status vocabulary

Use these exact strings. The Make filter is an exact match.

```
Planned    Drafted    Scored    Approved    Posted
```

Plus two Lina-internal states that should never reach the sheet: `Rejected` and
`Draft`. If you see them in the sheet, the export ran against the wrong file.

`Approved` is set by a human, never by a script. `sc-post.mjs --write` can set
`in_review`, `draft`, or `rejected` — it cannot set `approved`.

## score: do not filter on it

Tempting and wrong. Filtering `score >= 90` selects for posts that scored well on
*computed* checks, which biases the feed toward whatever the machine can measure:
hashtag count, sentence length, paragraph shape. Those are the dimensions where
there is the least room to be interesting.

Filter on `approvals` being non-empty. That is the gate. The score is a drafting
aid.

## Approvals format

A JSON array, escaped for Sheets:

```json
[{"decision":"approved","at":"2026-01-06T09:14:00Z","by":"human","note":"numbers check out"}]
```

`decision` is one of `approved`, `rejected`, `edited`, `held`.

`edited` also carries `edited_text`. When a human edits a post, add that text to
`persona/voice-samples.md` at the next maintenance pass — a human edit is the
highest-quality voice sample available.

## Export

```bash
node scripts/export-queue.mjs --out output/queue.csv
```

Writes only `Approved` rows with no hard blocks and a non-empty `approvals`
array. Refuses otherwise.

To load into Sheets, append to the tab, do not replace it: the sheet is the
working copy with `image_url` and `published_at` that only Make can fill.

## Read-back

Make writes `status`, `image_url`, `published_at`, `published_url`. Lina reads
those on the next run to build `output/published.jsonl`, which is what
`--history` repetition checks and `--drift` window checks need.

**If Make does not write back, the repetition detection silently stops working.**
That is the failure mode: nothing errors, the scores stay high, and the feed
quietly repeats itself for months.

## Verification columns

Add a `verified` column if you want a second pair of eyes. Set by a human, after
checking the published post actually says what `body` says.

Useful exactly once, after the first automated publish. Then it is noise.

## Do not add columns

Every added column is one more thing Make might read by position instead of by
name. If the sheet needs a new field, it belongs in `persona/` and comes through
the export — not typed into Sheets by hand.