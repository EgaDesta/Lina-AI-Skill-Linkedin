# Make.com bridge

Lina produces posts and stops. Make handles the parts that should not run inside
a conversational session: generating the image, storing the draft, publishing on
a schedule, writing the result back.

## The handoff

Two files, and one rule:

```
output/calendar.json   the plan
output/queue.csv       approved posts only
```

`queue.csv` is written by the export step below. Make reads it. Make never writes
back to `output/` except to `output/queue.csv.status` and to `output/published.jsonl`,
which Lina reads on the next run.

**The rule: Make does not generate copy.**

Content generation stays here, where `proof.yaml` is enforced and
`score-post.mjs` can fail the draft. A generator inside Make has no access to the
proof registry, so it will produce plausible numbers with no sources — which is
the exact failure this repo exists to prevent.

## Existing pipeline

If `Content generator linkedin.blueprint.json` and `Content posted
linkedin.blueprint.json` already exist in your Make workspace, the shape below
matches them and only the source changes:

| Make module | Change |
|---|---|
| `google-sheets:filterRows` | source becomes the Lina export sheet, status filter `Approved` |
| `builtin:BasicIfElse` | unchanged |
| `linkedin:ShareImage` | unchanged — takes `title`, `content`, `url` |
| `huggingface:generateImage` | prompt gets a column: `brief` |
| `google-drive:uploadAFile` | unchanged |
| `google-sheets:updateRow` | unchanged — writes `Posted` and `posted_at` |

That pipeline is `Gemini → Sheets → FLUX → Drive → LinkedIn`. It works. What it
does not do is check whether a number in the body exists in a proof registry.

## Sheet schema

`integrations/sheets.md` has the full column list. The columns Make needs:

| Column | Notes |
|---|---|
| `id` | the post id. The join key. |
| `status` | `Approved` is the only value the pipeline acts on |
| `title` | from the draft. Also the image prompt seed |
| `body` | `post.text`, unchanged |
| `image_url` | filled by Make |
| `image_brief` | from `content/formats.md`. Optional but better images |
| `visibility` | from `identity.publish.allowed_visibility` |
| `feed_distribution` | from `identity.publish.allowed_feed_distribution` |
| `score` | from `score-post.mjs`. Useful for sorting, not filtering |
| `approvals` | the JSON array. Proves the gate was passed |
| `posted_at` | written by Make |

## Export

```bash
node scripts/export-queue.mjs --out output/queue.csv
```

Writes every post at `status: "approved"` with no hard blocks. Refuses to export
anything else, and refuses to export a post whose `approvals` array is empty
unless `approval_required` is explicitly `false`.

`approvals` must be in the export. It is how a human reviewing the sheet can see
that a post was approved rather than merely written.

## Scenario

```
1. Schedule: every 15 minutes
2. Google Sheets: read the Lina sheet, filter status == "Approved"
3. Loop over rows
   a. If image_url is empty:
      - huggingface:generateImage with prompt = title + image_brief
      - google-drive:uploadAFile to the linkedin folder
      - update image_url
   b. linkedin:ShareImage
      title     = title
      content   = body
      url       = image_url
      altText   = title          (never empty; it is the always-visible version)
      visibility, feedDistribution from the sheet
   c. update the row: status = "Posted", posted_at = now
4. Return the row id so a retry does not double-post
```

**Idempotency matters more than speed.** The `id` and `status` columns are the
only thing stopping a retry from publishing twice. Make a retry possible and make
it harmless.

## Keeping Make and Lina honest

Make writes back:

- `status: "Posted"`, `posted_at` in the sheet
- `output/queue.csv.status` — the last successful run and row count

Lina's next `gen-calendar.mjs` run and `07-analytics-review.md` both need this.
The two systems are only as good as the write-back: if Make is not updating
`posted_at`, the analytics review has nothing to review.

## What Make must not do

- **Generate or rewrite copy.** No prompt inside Make touches `body`.
- **Publish anything not at `Approved`.** If the filter is missing, the scenario
  is broken. Test it with one row.
- **Change `visibility` or `feed_distribution`** from outside
  `identity.publish.allowed_*`. Those lists are the persona's, not the
  scenario's.
- **Retry a `ShareImage` failure without checking.** `linkedin:ShareImage` can
  succeed and still return an error. Confirm by searching the post text before
  retrying, exactly as `integrations/browseros-neo.md` says.

## Setup

1. Run Lina end to end once, by hand, on one post: generate → score → approve →
   publish manually. Confirm the copy and the result.
2. Then automate only the parts already verified by hand: image generation,
   storage, scheduled publishing.
3. Keep the approval gate in the sheet, not in the scenario. A gate inside an
   automation is a gate someone will disable during a busy week.

## Verification

After the first automated run, verify by hand:

- Did the image render at the right ratio?
- Is the alt text present?
- Did visibility match the sheet?
- Does `output/published.jsonl` have the post?

If any of those are wrong, fix Make before the second run. Nothing downstream of a
broken first run is trustworthy.