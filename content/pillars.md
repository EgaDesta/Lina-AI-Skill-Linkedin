# Content Pillars

A pillar is a promise to one kind of reader. Five or fewer, because more means
nobody can name what the account is about when asked.

`weight` in `persona/pov-map.yaml` is the share of the feed. `gen-calendar.mjs`
builds the plan to match it and reports drift against it, so a persona does not
quietly become one thing.

## The generic set

Use these until `pov-map.yaml` has your own. They are chosen because they map
onto the audience's actual decision sequence rather than onto a topic list.

| id | Label | Share | Reader is asking | What proof it needs |
|---|---|---|---|---|
| p1 | Diagnostic | 40% | "How do I tell if this is even a problem for me?" | Numbers about the symptom's size |
| p2 | Method | 25% | "What is the actual process?" | Named method, sequenced steps |
| p3 | Evidence | 20% | "Does this work for someone like me?" | Case studies, sourced metrics |
| p4 | Position | 10% | "Why this person and not the obvious alternative?" | Argued belief, not credentials |
| p5 | Signal | 5% | "What changed in the field this week?" | Observation, dated, attributed |

## The rules that make pillars work

**Diagnostic posts must not sell.** The reader of a diagnostic post is still
forming the problem. Pitching here is the single most common reason a
professional audience stops following.

**Method posts must be reusable by someone who has never met you.** If the post
only makes sense inside your context, it is an anecdote, not a method.

**Evidence posts must name the situation.** "Reduced processing time by 40%" is
worthless. "For a 12-person team doing 200 invoices a week by hand" is worth
something, because the reader can recognise themselves in it.

**Position posts are where the account becomes recognisable.** They are also the
highest risk of looking arrogant. One belief argued properly beats five positions
announced.

**Signal posts must be dated and attributed.** Undated trend posts are opinion
wearing a news costume.

## Pillar hygiene

- Any pillar below 5% of the feed over 30 posts has effectively been abandoned.
  `rubric/brand-consistency.yaml` flags this. Either revive it or delete it from
  `pov-map.yaml` — an abandoned pillar in the config is a lie about the strategy.
- A post that scores above 0.30 on two pillars is a bleed. Split it into two
  posts instead of averaging it into something unclear.
- Never run two pillars adjacent on the same day. It reads as a campaign, and
  campaigns get scrolled past by exactly the audience you built them for.

## Mapping pillars to the rest of the system

```
pov-map.pillars          weight, maps_to_beliefs
        |
        +-> gen-calendar.mjs        rotates slots to hit the weights
        +-> score-profile.mjs pcx2  checks >=2 pillars visible on the profile
        +-> prompts/generate-post.md  receives pillar as an explicit input
        +-> 07-analytics-review.md   compares realised reach against the plan
```