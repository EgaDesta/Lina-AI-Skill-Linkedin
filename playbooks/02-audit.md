# Playbook 02 — Audit

For a profile that already exists. Produces an ordered list of changes and a
number that can be compared over time.

## Step 1 — Capture the profile

Three ways, in order of preference.

**Preferred: JSON export.** Write it to `data/examples/<slug>.json`. The shape is
in `data/examples/sample-profile.json`. Best because it is reproducible — the same
file scores the same way forever, so a score change means the profile changed.

**LinkedIn API** if available.

**BrowserOS neo scrape.** See `integrations/browseros-neo.md`. Falls back to this
playbook's field list.

Minimum fields for a meaningful audit:

```json
{
  "custom_url_slug": "",
  "headline": "",
  "about": "",
  "experience": [{ "title": "", "company": "", "bullets": [] }],
  "featured": [{ "title": "", "kind": "", "url": "", "description": "" }],
  "education": [{ "school": "", "field": "", "year": null }],
  "licenses": [{ "name": "", "issuer": "", "year": null }],
  "skills": ["", ""],
  "contact": { "email": "", "website": "", "phone": "" },
  "banner_image": "",
  "profile_photo": ""
}
```

Empty arrays are honest. A profile missing Featured is `[]`, not omitted — the
rubric needs to know it is missing.

## Step 2 — Score

```bash
node scripts/score-profile.mjs --file data/examples/<slug>.json --out output/reports/profile-<slug>-<date>.json
```

Human-readable output by default. `--json` for the machine path. Exit 1 below
`--min` (default 60).

## Step 3 — Interpret

`prompts/audit-profile.md`. The script measures; the prompt orders, writes the
replacement copy, and identifies the proof gaps.

Save the markdown to `output/reports/profile-<slug>-<date>.md`.

## Step 4 — Read the bands

| Score | Band | Meaning |
|---|---|---|
| 0–39 | `not_ready` | Invisible to the target audience. Do not run campaigns or post. |
| 40–59 | `needs_work` | Readable, not differentiating. Completeness first. |
| 60–79 | `workable` | Generates inbound, conversion path leaking. |
| 80–92 | `strong` | Clear, specific, defensible. Growth comes from volume. |
| 93–100 | `category_leader` | Attracts inbound from people who already know the field. |

A `capped: true` report means a blocker failed and the total is held at 59
regardless of everything else working. Read `cap_reason`. Fix that check first.

## Step 5 — Read in the right order

`rubric/severity.md`, "Ordering": hard blocks, blockers, warns by points at
stake, nices. The first three `next_actions` are the whole job.

Do not work through twenty items. Three done properly beats twenty done halfway,
because each fix shifts the positions of everything below it.

## Step 6 — Fix order

Not the rubric order. Dependency order:

1. **Positioning.** `pc5` named method, `pc2` primary keyword. Everything else
   inherits from these.
2. **Proof.** `ps4`, `ps1`, `ps3`. The reason most profiles stall at 70.
3. **About.** `pc4`, `pc6`, `rb2`–`rb4`. Only useful once 1 and 2 exist.
4. **Experience bullets.** `ps2`.
5. **Featured.** `cm6`, `cv3`.
6. **Conversion.** `cv1`, `cv4`. Last, because a CTA pointing at nothing
   unfinished is worse than no CTA.
7. **Completeness.** `cm1`–`cm7`.
8. **Voice.** `pcx1`–`pcx3`.

## Step 7 — Re-score

Same file, after the fixes. Compare. If the score moved but you do not know why,
find out — `dimensions` in both reports carry `measurements` per check.

## Step 8 — Content follows

Only now.

```bash
node scripts/gen-calendar.mjs --start <next monday> --days 30 --csv
```

`brand-consistency.yaml` stop condition `sc_stop_1` applies below 40. Writing
content for a profile scoring under 40 amplifies the wrong message to a wider
audience, which is worse than doing nothing.

---

## Repeat

Quarterly for a healthy profile, monthly for one under 75. Compare reports by
date. What matters is not the absolute score but which dimensions stopped moving
— that tells you which section you have stopped maintaining.