# Fill checklist

The order matters. Each file produces input the next one needs, and skipping
ahead produces copy that has to be redone.

Check your progress at any point:

```bash
node scripts/validate-persona.mjs
```

---

## 1. `identity.yaml` — who this is

The file everything else inherits from. Nothing else can be written until
`positioning.statement` exists.

| Field | Fill with | Note |
|---|---|---|
| `profile.display_name` | your name as it will appear | |
| `profile.role_title` | the title buyers search | not aspirational |
| `profile.domain` | your niche, kebab-case | `operations-automation`, not `my-niche` |
| `profile.custom_url_slug` | `name-domain` for `linkedin.com/in/…` | claim it now, it is hard to change later |
| `profile.timezone` | `Asia/Jakarta` | required before anything can be scheduled |
| `positioning.statement` | one sentence: who + outcome + method | see below |
| `positioning.problem` | the painful thing, in their words | interview two people, or read their posts |
| `positioning.method` | **a named approach** | the most important field here |
| `positioning.differentiator` | why you over the alternatives | not credentials |
| `profile.primary_language` | `en` | Lina writes in English |

### The method needs a name

```yaml
method: "The First 90 Days Method"
```

Not "a holistic approach". A method you cannot name cannot be referred to by you,
remembered by a reader, quoted by someone else, or searched for. If you cannot name
yours yet, that is the actual work, and `validate-persona.mjs` will not let you
skip it.

Good: "The 3-Step X", "The Y Framework", "The Onboarding Reset".
Bad: "Comprehensive solutions", "Proven methodology", "Best practices".

### The publish gate

Leave it alone until you have run the pipeline for real:

```yaml
publish:
  mode: draft              # draft | queue | auto
  approval_required: true
  min_post_score: 75
```

`auto` publishes to LinkedIn. It requires flipping `approval_required` to `false`
and will not work without a timezone. Do not change this while learning the system.

## 2. `audience.yaml` — who they are

One segment well beats three half-filled. Fill `segment-1`; delete or leave the
others empty.

| Field | Fill with | Why it matters |
|---|---|---|
| `role_titles` | exact job titles, as typed in LinkedIn search | this drives the target list in engagement |
| `goals` | what they are trying to do right now | |
| `pains` | what it costs them to do nothing | |
| `failed_attempts` | what they already tried | tells you what not to recommend |
| `vocabulary` | **their words, harvested verbatim** | see below |
| `objections` | what stops them buying | content must pre-empt these |
| `trust_signals` | what earns their trust, ranked | decides which proof leads |

### Harvest the vocabulary

Do not invent it. Go to LinkedIn, search your primary keyword, and read the
comments under other people's posts in your niche. Copy the phrases they actually
use. Ten real phrases beat thirty invented ones, and they are what stops the copy
sounding like a brochure.

Then set `relationships.segment-1.doesnt_know` — the belief the content has to
cause. This is the bridge between what they believe now and what you want them to
believe.

## 3. `proof.yaml` — what you can actually claim

**The file that matters most, and the one people skip.** Everything else in this
repo exists to stop you filling it with plausible fiction.

| Field | Fill with |
|---|---|
| `policy.require_source_for_numbers` | leave `true` |
| `entries[].tier` | `verified` (a document exists), `observed` (you were there), `anecdotal` (second-hand) |
| `entries[].source` | a document, a dashboard, a link, who told you |
| `entries[].source_date` | `YYYY-MM-DD` |
| `entries[].permission` | `granted` before naming a client, otherwise generic |
| `entries[].metric.value` | the number |
| `entries[].metric.baseline` | where it started — a result without a baseline is a number, not evidence |
| `entries[].freshness_months` | when it stops being true |

At least three entries. Five is better.

### If you have no results yet

This is the honest path, and it works:

1. **Process posts.** Show the method, not the outcome. "Here is the exact
   sequence I run, and where it usually breaks." Publishable with zero
   unverifiable claims.
2. **Opinion posts** from your beliefs, hedged, at claim level 1.
3. **Observation posts** from direct work, framed as observation.

These will score lower on specificity. That is the system reporting accurately, not
a bug. `proof.yaml` ends with these instructions in more detail.

Never write "studies show", "industry average", or "research proves". If there is no
named study, it is fabrication, and your audience is exactly the kind that checks.

## 4. `pov-map.yaml` — what you argue

| Field | Fill with |
|---|---|
| `beliefs[].claim` | one sentence, falsifiable |
| `beliefs[].position` | `most_likely`, `majority`, `mainstream`, `minority`, `contrarian` |
| `beliefs[].confidence` | `high` / `medium` / `tentative` |
| `beliefs[].because` | the reasoning, one sentence |
| `beliefs[].evidence_refs` | `proof.yaml` ids — **required for `high`** |
| `beliefs[].open_to` | what would change your mind |
| `hot_takes[].take` | one, specific enough that a reasonable person could disagree |
| `anti_positions` | what you argue against. Never name a competitor |
| `pillars[].label` | 4–5 labels |
| `pillars[].weight` | must sum to 1.00 |

### The confidence rule

`validate-persona.mjs` blocks a belief at `high` confidence with no `evidence_refs`.
This is not bureaucracy — it is the difference between a POV map that is an
argument and one that is a wish list. If you have no proof, set `medium` and write
a weaker `because`.

### Pillar weights

Five pillars, summing to 1.00. `content/pillars.md` has the generic set
(Diagnostic / Method / Evidence / Position / Signal) and the rules for each. Start
from those and rename to fit your niche. `gen-calendar.mjs` rotates slots to match
your weights and reports drift, so these are enforced rather than decorative.

## 5. `offers.yaml` — what they get

| Field | Fill with |
|---|---|
| `ladder[].cta_text` | the exact words used in-post — **every rung needs one** |
| `ladder[].cta_destination` | a real URL, `comment`, or `dm` |
| `ladder[].serves` | which pillars this rung belongs to |
| `ladder[].requires_proof_refs` | `true` on the sales rungs |
| `paid_offers[].name` | the offer |
| `paid_offers[].outcome` | what they end up with |
| `paid_offers[].price_model` | `fixed`, `retainer`, `value`, `hourly` |
| `cta_policy.forbid` | generic engagement phrases |

`paid_offers` is a **blocking** gap. A profile that generates attention and
converts none of it is a vanity project, so the rubric refuses to score well
without one.

Rung 1 must be genuinely useful on its own. If it exists only to sell rung 4, the
whole funnel reads as bait. `content/ctas.md` has the discipline.

## 6. `keywords.yaml` — how you get found

| Field | Fill with |
|---|---|
| `primary.keyword` | one phrase a buyer would actually type — **blocking** |
| `primary.intent` | `problem_solving`, `solution_lookup`, `hiring`, `learning`, `comparison` |
| `secondary[].keyword` | **maximum three** |
| `phrase_bank` | `how_to`, `when`, `vs`, `for` variants — natural language, not industry terms |
| `hashtags.core` | 1–2 for most posts |
| `hashtags.banned` | clickbait or miscategorisation |
| `negative_keywords` | topics that attract the wrong audience |

Beyond three secondary keywords the profile stops being legible and starts looking
like stuffing. `score-profile.mjs` `pc2` requires the primary keyword in the
headline, and it is a blocker.

## 7. `voice.yaml` — how you sound

Do this **after** the voice samples, because the samples are the source of truth.

| Field | Fill with |
|---|---|
| `tone.adjectives` | 3–5 that describe you, not what you want to be |
| `vocabulary.prefer` | 10–20 words harvested from `voice-samples.md` |
| `vocabulary.avoid` | anything on top of the shipped defaults |
| `formatting.emoji` | `false` unless emoji are genuinely your thing |
| `banned_patterns` | extra regexes beyond the shipped defaults |

Everything else in this file ships with sensible defaults. Do not tune it by
guessing; tune it by measuring.

## 8. `voice-samples.md` — the honest source

The only file that shows Lina. A voice config with no samples is a theory.

1. Write 3–10 posts the way you would write them if nobody were analysing it.
2. Do **not** write them to fit the config. The config is derived from these.
3. Paste each into a `## Sample N` block. Line breaks as written.
4. Run `node scripts/validate-persona.mjs` and read the measured line.

```
VOICE MEASURED FROM SAMPLES
  3 samples  mean sentence 12.4 words  variance 0.51  emoji/post 0  hashtags/post 3
```

Where the samples and `voice.yaml` disagree, **the samples win.** Fix the config
to match reality rather than the reverse.

These are calibration input, not content. Do not publish from this file.

---

## After you have filled it

```bash
node scripts/validate-persona.mjs          # no blocking gaps
node scripts/gen-calendar.mjs --days 30    # a plan exists
```

Then `playbooks/01-build-from-zero.md` for the profile, or
`playbooks/02-audit.md` if the profile already exists.

## A note on time

`identity.yaml` and `audience.yaml` take the longest because they require real
thought about who you are and who you serve. The other files take an hour, less if
you write honestly.

If you find yourself writing `proof.yaml` entries by wishing a number into
existence, stop and go back to the process-content path. It works, and it does not
cost you the account.