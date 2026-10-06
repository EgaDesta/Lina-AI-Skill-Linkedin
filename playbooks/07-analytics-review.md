# Playbook 07 — Analytics review

The only playbook where numbers come from LinkedIn rather than from the rubric.
The rule that governs it: **measure, never estimate.** Every reach claim in this
repo is either from analytics or absent.

## Cadence

Monthly, against a full month of posts. Weekly is too noisy — LinkedIn's own
numbers swing day to day on the same post, and reading them daily produces
conclusions that reverse.

## What to collect

Per post, at 24h and 7d, from LinkedIn's post analytics:

```
post.metrics = {
  impressions, profile_views, reactions, comments, reposts, inbound_messages, measured_at
}
```

`inbound_messages` is the only metric that matters most and the one least likely
to be noticed. It is the whole funnel in one number.

## The honest causal limits

Read this before concluding anything.

- **Posts run for months.** A week-old post getting most of its impressions is
  normal. A 24-hour read is close to meaningless.
- **There is no control group.** Nothing tells you what would have happened
  without the post. Every claim of the form "posting X got me Y" is unverified.
- **The audience is not random.** It is whoever followed you, plus reshares.
  Composition changes over months, so the same post is not competing in the same
  room twice.
- **Timing is the strongest lever and the easiest to fool yourself about.** Two
  posts at different hours on the same topic look like a topic result when it is
  a timing result. Change one variable.
- **LinkedIn changed the algorithm again.** Post reach numbers from a year ago are
  not comparable to today.

Anyone who tells you a format produces X% more reach has one data point and is
confident about it.

## The monthly review

### 1. By pillar

```bash
node -e "
const fs=require('fs');
const posts=fs.readFileSync('output/published.jsonl','utf8').trim().split('\n').map(JSON.parse);
const m={};
for(const p of posts){ if(!p.metrics) continue;
  m[p.pillar] ??= {n:0,imp:0,prof:0,msg:0};
  m[p.pillar].n++; m[p.pillar].imp+=p.metrics.impressions||0;
  m[p.pillar].prof+=p.metrics.profile_views||0; m[p.pillar].msg+=p.metrics.inbound_messages||0;
}
for(const[k,v]of Object.entries(m))
  console.log(k, 'n='+v.n, 'imp/post='+Math.round(v.imp/v.n), 'profileViews/post='+Math.round(v.prof/v.n), 'msgs='+v.msg);
"
```

Compare against `pov-map.pillars[].weight`. A pillar getting 20% of views and
40% of inbound messages is the pillar to expand. A pillar getting 30% of views
and no messages is a vanity pillar — it looks good in the dashboard and changes
nothing about the business.

### 2. By archetype

Same calculation on `archetype`. The mix cap in
`brand-consistency.yaml` is a distribution rule, not a performance rule. If one
archetype systematically earns more inbound, raise its cap and re-run
`gen-calendar.mjs` — but change one thing, so the next month can tell whether it
worked.

### 3. By hook family

Same calculation on `hook_pattern`. The cheapest lever in the system, because
changing a hook family costs one line in `content/hooks.md` and nothing else.

### 4. Voice drift

```bash
node scripts/check-voice.mjs --file data/examples/<slug>.json --history output/published.jsonl --drift
```

Checks over the window from `brand-consistency.yaml`:

| Check | Threshold | What it means when breached |
|---|---|---|
| pillar distribution | TVD > 0.20 | planning has drifted from the persona |
| archetype share | > 25% of window | the feed has become one thing |
| mean sentence words | > 25% from samples | the writing voice is moving |
| second/first person | outside 1.2–6.0 | addressing the reader has changed |
| emoji per post | > 0 when configured at 0 | the persona is dissolving |
| hook reuse | > 15% of window | repetition is setting in |
| 4-gram overlap | > 0.25 between any pair | near-duplicate posts |
| proof reuse | one entry > 20% of window | the persona sounds like a case-study bot |

`sc_stop_4` fires when drift affects over 40% of the window. Rebuild
`voice-samples.md` before generating anything else.

### 5. Proof freshness

Any `proof.yaml` entry past `freshness_months` being used in present tense. Not
drift exactly, but the same failure: results that stopped being true, repeated
until they were embarrassing.

### 6. What to change next month

Exactly one thing. Write it down in `CHANGELOG.md`.

Changing the pillar mix, the hook families, the posting times, and the archetype
caps in the same month means the next review cannot tell which change mattered.
The temptation is to change everything, because everything looks bad. That is the
failure mode this playbook exists to prevent.

## Track it

Every month's review appends a section to `CHANGELOG.md`:

```markdown
## Review 2026-01

In: 14 posts, 2,140 profile views, 3 inbound
Out: hook family "cost-first" replaced "observation" (cost-first averaged
     1.6x the profile views of the window average)
Changed: exactly one thing, as above
Not changed: archetype caps (too early to read)
```

## The number to watch

Not impressions. **Profile views per post, and inbound messages per month.**

Impressions are vanity and they reward formats that go viral. Profile views mean
the post made someone curious about the person. Inbound messages mean the profile
did its job. A persona can have excellent impressions and zero inbound forever,
and the analytics will show it looking like a success the whole time.