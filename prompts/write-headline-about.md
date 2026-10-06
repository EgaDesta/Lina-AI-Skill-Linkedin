# Prompt — headline and About

Runtime prompt for the two highest-leverage profile fields.

## Preconditions

Do not run this until `positioning.statement`, `positioning.method`, and
`keywords.primary.keyword` are filled. Without a named method there is nothing
to write, and a headline generated from an empty persona is a headline full of
buzzwords.

## Prompt

```
You are writing the headline and About section for a LinkedIn profile. English.

## Persona
positioning.statement: {statement}
positioning.problem: {problem}
positioning.method: {method}
positioning.differentiator: {differentiator}
profile.role_title: {role_title}
profile.seniority: {seniority}
keywords.primary: {primary.keyword}
keywords.secondary: {secondary keywords}
offers.paid_offers: {name, outcome, who_it_is_for}
proof.entries with tier and source: {id, claim, metric}
audience primary segment: {role_titles, goals, pains, objections}

## HEADLINE — generate 5 candidates
Formulas are in templates/headline.formulas.md. Constraints, all hard:
- 220 characters maximum. Count.
- primary.keyword present verbatim
- role_title present
- an outcome, not only a role
- the named method if it fits within the limit
- no number that is not in proof.yaml. If a metric would improve it and none is
  available, write `[metric from proof entry]` as a placeholder and flag it.
- no phrase from content/slop-blacklist.md
- no emoji, no pipes-heavy keyword stuffing, no "guru", no "ninja"

For each candidate give: the text, the character count, the formula used, and
which check it would pass. Do not rank them. Ranking is a judgement the human
makes; a ranking from you is a recommendation they will defend to themselves
later without evaluating it.

Then write one more candidate that is deliberately uncomfortable: one with no
keyword in it at all, just a clear statement of who this is and what they get.
It will probably score worse on `pc2`. Include it anyway, because some people
have a distribution advantage that makes `pc2` irrelevant, and the human
decides whether that applies.

## ABOUT — write against one skeleton
Skeletons in templates/about.skeletons.md. Choose the one that matches
positioning.differentiator's shape, and say why.

Hard constraints:
- 2600 characters maximum, 1200-1800 preferred.
- **The first 210 characters carry the whole post.** Only that is visible
  before LinkedIn's truncation link. It must contain the problem, the keyword,
  and the method. No origin story, no "I have been working in", no job history.
  `score-profile.mjs` check `pc4` fails the biography opening.
- The character at position 210 must fall on a sentence boundary. Check
  `rb2` fails a mid-clause truncation.
- Paragraphs under 180 characters. `rb3`.
- Mean sentence length under {target+6} words. `rb4`.
- Every number from proof.yaml with a valid tier. If none, use no numbers.
- Exactly one CTA, matching `offers.cta_policy`, not from the forbid list.
  `cv1`.
- No banned phrase.

Structure the response as:
1. The 210-character opening, as its own block, so it can be counted.
2. The rest, paragraph by paragraph, with a note on what each paragraph does.
3. The CTA and where it goes.
4. Everything you flagged as `[needs human]` and why.

## Rules
- Do not hedge. No "I believe", no "in my humble opinion". A headline and an
  About section are declarations.
- Do not explain what you wrote or offer alternatives for a sentence. One version.
- If the persona data is too thin to write a real headline, stop and list what
  is missing. Do not fill it with industry-general phrasing.
```

## Verify before saving

```bash
node scripts/score-profile.mjs --file data/examples/<slug>.json --json
```

Check `pc2`, `pc4`, `pc5`, `rb1`–`rb4`, `cv1`. The script measures the copy you
just wrote; if it disagrees with your estimate, the script is right.