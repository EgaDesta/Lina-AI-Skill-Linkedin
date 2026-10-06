# Prompt — propose persona from a live profile

Runtime prompt for `playbooks/08-import-from-url.md` step 4. Reads an extracted
profile and its audit, and writes a **proposal** the user reviews.

## Preconditions

Do not run this unless:

1. `scripts/import-profile.mjs` returned `sound` or `usable_with_caveats`
2. `scripts/score-profile.mjs` has run on the same file, and its output is in context

On `unsound`, stop. A proposal built from a misread profile is worse than no
proposal, because it gets pasted into `persona/` and trusted.

## Prompt

```
You are proposing persona fields from someone's existing LinkedIn profile.

## Extraction verdict
{verdict, and every failing check with its detail}

## Audit
{score, band, top three fixes, and which checks failed}

## Profile as extracted
{headline, about, experience[], featured[], skills[], education[], licenses[]}

## Your output
Write to output/reports/persona-proposal-<slug>.md. Do NOT edit persona/*.yaml.

### Rules

1. **Every proposal cites its evidence.** Two labels, used exactly:
   - `extracted` — read directly off the profile. "role_title: Operations
     Manager — from the current role title"
   - `interpreted` — your reading of it. "seniority: practitioner —
     interpreted from a solo 'Independent' entry, correct me if wrong"
   Nothing without a label. A reader must be able to tell at a glance which
   fields they can trust without checking.

2. **Never propose a proof.yaml entry.** Not one. The profile contains numbers and
   some are results, but you cannot tell which, and a tier or a source written on
   the user's behalf is a claim you cannot stand behind. Instead, list the numbers
   the verification report flagged and ask which are results and where the evidence
   is. Note that these are the easiest numbers to source, because the person
   already published them.

3. **Never propose a named client or employer** in copy. Generic subjects only:
   "a 14-person finance team", not the company's name. If a company appears in
   the experience, it is fine to reference that factually in a bullet about their
   own career — what must not happen is attributing a client result to it.

4. **If the profile does not make the niche clear, ask.** A wrong `domain` becomes
   a keyword nobody searches, which is worse than an empty field because it looks
   filled. "The headline and About point at process work for services firms; is
   that the niche, or is this one part of a broader practice?"

5. **Distinguish a method from a description.** If the About describes a way of
   working, propose naming it and give two candidate names. If there is no method,
   say so — `positioning.method` is a blocking gap and pretending otherwise leaves
   the user with a persona that cannot pass validation.

6. **Propose the audience segment from their evidence, and flag thin evidence.**
   Role titles come from their own experience and headline. Pains and objections
   are almost always inferred, so label them as such and mark the confidence. Do
   not manufacture three segments: propose one, and say what a second would need.

7. **Quote their words for the positioning statement.** Take language from their
   About rather than writing fresh. The positioning sentence should sound like
   something they would say, because it has to survive being read back by their
   own audience.

8. **List what you deliberately did not propose,** and why. Missing proof, named
   clients, seniority, anything ambiguous. This section is what makes the proposal
   auditable.

### Output shape

# Persona proposal — <name>

From: <slug>   Extraction: <verdict>   Audit: <score>/100 (<band>)

## Blocking gaps this proposal would close
| field | value | evidence | label |
(proposed fields only — the ones validate-persona.mjs treats as blocking)

## Optional fields
(same table)

## Numbers found on the profile
Each as: value — the sentence it appeared in — is this a result or structural?
State that the tier and source must come from them, not from you.

## What I did not propose
(bullet per omission, with the reason)

## What I need from you
(the decisions only they can make, numbered, each with a default they can accept
 by saying nothing)

## Verbatim source
(quote the lines from their profile that the proposals came from, so every
 proposal can be checked against the original)
```

## After they approve

Only then, and only for the fields they approved:

1. Apply to `persona/*.yaml`
2. `node scripts/validate-persona.mjs` — show what is still missing
3. Stop. Content generation waits until there are no blocking gaps.

Applying to `proof.yaml` is a separate conversation, entry by entry, and only
from what they told you.