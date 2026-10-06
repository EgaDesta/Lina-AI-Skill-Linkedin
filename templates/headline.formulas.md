# Headline Formulas

220 characters maximum. Count before saving — LinkedIn truncates at 220 and
`score-profile.mjs` `rb1` measures it.

Four slots, filled in priority order. Stop when you hit 220.

```
ROLE_TITLE | OUTCOME for AUDIENCE | METHOD | PROOF
```

Priority runs left to right. If the proof metric does not fit, drop it, never the
role title.

## 1. Category plus outcome

The default. Works when the method is not worth naming in a headline.

```
{Role} | I help {audience} {outcome}
{Role} helping {audience} {outcome}
{Role} for {audience} who want {outcome}
```

Example: `Automation Consultant | I help small operations teams cut manual handling in half`

## 2. Problem-first

Works when the audience describes themselves by their pain rather than their job
title. Better search match in practice.

```
{Role} | Stop {pain}
{Fixing the problem that {audience} keep hitting: {pain}
The {pain} problem — and how to end it
```

Example: `Operations Consultant | Stop losing hours to work nobody designed`

## 3. Method-named

The strongest for recall, and it only works if the method name is one someone
would actually repeat. "The 3-Step X" is a name. "Holistic solutions" is not.

```
{Role} | The {Method}
{Role} — I run {Method}, the {n}-step approach to {outcome}
{I help {audience} {outcome}} using {Method}
```

Example: `Automation Consultant | The First 90 Days Method`

## 4. Proof-led

Only with a real, sourced number from `proof.yaml`. `cv2` and `ps4` check it.
Without one this collapses into the formula that earns no trust.

```
{Role} | {metric} for {subject} | {Method}
{Cut/reduced/grew} {metric} | {Role} | {Method}
{metric} {outcome}, in {period}
```

Example: `Automation Consultant | 14 days to 3 on onboarding | The First 90 Days Method`

## 5. Anti-title

`{what you believe}`. Works only with a strong existing audience and an
established reputation. Cold, it reads as arrogance.

```
{Take from pov-map.hot_takes}
Nobody tells {audience} {uncomfortable truth}
```

## 6. Two-liner

Only if the first field is a role the market recognises.

```
{Role} | {specific thing} | {who it is for}
{Role} | {Method} | {secondary keyword}
```

## 7. Hiring or availability

Only when the profile's actual purpose is inbound work from a stated persona.

```
{Role} | {specific thing} | Open to {type of engagement} from {audience}
```

## 8. Keyword-anchored

The least appealing formula, included for completeness. LinkedIn search needs
the term; humans do not care.

```
{primary keyword} | {Role} | {outcome}
{primary keyword} for {audience} | {Role}
```

`score-profile.mjs` `pc2` requires the primary keyword somewhere in the
headline. If formulas 1-4 leave no room, use this one rather than cramming the
keyword into a slot it does not belong in.

---

## Rules

- **The primary keyword is mandatory.** `pc2` is a blocker. It is the one field
  that reliably surfaces in LinkedIn search.
- **The role title must be recognisable.** Not aspirational. Use the words
  people put in the search box.
- **One outcome, not three.** A headline promising everything gets nothing.
- **No banned phrases.** See `content/slop-blacklist.md`.
- **No emoji.**
- **No keyword list.** `Consultant | Automation | AI | Ops | Growth` reads as
  spam to a human and does not rank better than two honest keywords.

## Testing

Run after writing:

```bash
node scripts/score-profile.mjs --file data/examples/<slug>.json --json
```

`pc1` role title, `pc2` primary keyword, `pc3` outcome, `pc5` named method,
`rb1` length. All five are cheap and mechanical.

Then paste it into a search on LinkedIn for `primary.keyword`. If the profile
does not appear in the first page, the keyword placement is not working, whatever
the script says. The script checks presence, not rank.