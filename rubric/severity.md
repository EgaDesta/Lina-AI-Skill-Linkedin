# Severity

Every check in the rubrics carries a severity. It decides **what happens**, not
how many points it costs. A `blocker` can cost 4 points and still be the only
thing standing between a draft and publication.

| Severity | Meaning | Effect on scoring | Effect on workflow |
|---|---|---|---|
| `blocker` | The profile or post cannot do its job at all | Points lost, and capped | Draft cannot be queued. Must be fixed. |
| `warn` | Working, but leaking measurable value | Points lost | Reported with a suggested fix, fixable in the next pass |
| `nice` | Genuinely optional | Points lost | Reported only |

## Caps

Caps exist so that a profile cannot compensate for a fatal gap by being
excellent everywhere else.

**Profile total cap — 59**, if any of these fail:
- `pc2` headline has no primary keyword
- `cm3` About section missing
- `cv2` no offer defined
- `ps4` a proof entry used in the profile has no source

**Draft status cap — `rejected`**, if any of these fail:
- any `hard_blocks` entry in `rubric/post-rubric.yaml`
- `hook` dimension below 8/20

Rationale: a post with a dead opening line does not get rescued by good body
copy. It gets scrolled past, and the profile view is lost anyway.

## Ordering

Findings are reported in this order, regardless of point value:

1. **hard blocks**
2. **blockers**
3. **warns**, descending by points at stake
4. **nices**

A report that leads with "you lost 3 points on hashtag placement" is noise.
Every report from Lina leads with what would have made the thing fail.

## Suggested-fix quality

Every finding carries a fix. A finding without a fix is a complaint.

- **Computed findings** get a concrete replacement: the offending line, the
  measured value, the target value, and a rewritten version drawn from
  `templates/`.
- **Judged findings** get the specific sentence that failed and why, plus the
  question the writer has to answer to fix it.

`score-profile.mjs` and `score-post.mjs` both accept `--json` so a fix can be
rendered as an editable proposal rather than prose.

## What never appears in a report

- Generic advice with no measurement attached
- Aesthetic judgements (photo, banner, colour, font)
- Score deltas framed as progress without a previous report to compare against
- Any claim about how the change affected reach. Lina cannot know that without
  analytics; guessing is the exact failure this repo exists to prevent. See
  `playbooks/07-analytics-review.md` for the honest version.