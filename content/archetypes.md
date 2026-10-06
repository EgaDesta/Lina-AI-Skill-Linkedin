# Archetypes

Ten post shapes. `gen-calendar.mjs` assigns them from a fixed mix capped at 25%
each by `rubric/brand-consistency.yaml`, with at least 35% actionable. Lina
does not pick an archetype by what seems interesting.

## Mix

| Archetype | Cap | Actionable | Needs proof | Job |
|---|---|---|---|---|
| `how_to` | 25% | yes | preferred | Teach a procedure that works today |
| `framework` | 25% | yes | preferred | Teach the named method as a whole |
| `observation` | 25% | yes | preferred | Report a pattern from real work |
| `case_study` | 25% | yes | **required** | Show one situation and its result |
| `checklist` | 25% | yes | no | Verifiable done/not-done list |
| `myth_busting` | 25% | no | preferred | Refute a specific common belief |
| `opinion` | 25% | no | no | Argue a belief, hedged |
| `story` | 25% | no | preferred | One event, one decision, one consequence |
| `question` | 25% | no | no | Ask something whose answer changes something |
| `announcement` | 25% | no | no | Only about the person, never a product release |

---

## `how_to`

Structure: hook → the outcome in one line → numbered steps → the step that
usually fails → CTA.

Rules:
- Every step is an action, not a description of an action. "Define the trigger
  event" passes. "Think about what would start this" fails.
- One step must be the one that usually fails. Naming it is what makes the post
  worth saving.
- No step may require a tool the reader does not have.

## `framework`

Structure: hook → name the framework and give it a job → the components in
order → one worked example → CTA.

Rules:
- The framework must be named in `positioning.method`. An unnamed framework in
  the body but not the profile breaks the link between them.
- Three to five components. More is a list, not a framework.
- The worked example must be concrete enough to check.

## `observation`

Structure: hook → the pattern → what it looks like in practice → what it does
not mean → CTA.

Rules:
- Must be framed as observation, never as law. "In the eight projects I worked
  on this year" not "Studies show".
- The "what it does not mean" section is what makes it credible. Without it,
  an observation reads as a trend claim.

## `case_study`

Structure: hook → the situation including the cost of doing nothing → what was
changed → the result → CTA.

Rules:
- Every number from `proof.yaml`, with the entry id in the post's `proof_refs`.
- The baseline matters more than the result. A result without a baseline is a
  number, not evidence.
- No named client without `permission: granted`.
- One subject per post. Two subjects reads as a brochure.

## `checklist`

Structure: hook → what the list certifies → items → how to use it → CTA.

Rules:
- Every item is verifiable as done or not done. "Review your positioning" fails.
  "Check whether your headline names an outcome" passes.
- Between 5 and 9 items. Fewer is a short post; more is a document.

## `myth_busting`

Structure: hook → state the belief as its believers state it → why it is
wrong, with the mechanism → what to do instead → CTA.

Rules:
- The myth must be quoted closely enough that its believers recognise it.
- Argue the belief, not a person or company. `anti_positions.names_competitor`
  must stay false.
- The mechanism is the whole post. "It is wrong" is not an argument.

## `opinion`

Structure: hook → the claim, stated as a claim → the reasoning → what would
change my mind → CTA.

Rules:
- Must attach to `pov-map.beliefs` or `hot_takes`. An unanchored opinion post is
  noise, and check-voice will flag it as unsourced authority.
- Confidence from `pov-map.beliefs[].confidence`. `high` claims without
  `evidence_refs` are blocked by `validate-persona.mjs`.
- The "what would change my mind" line is mandatory. Without it, a position is
  a stance, and stances do not earn trust.

## `story`

Structure: hook → the moment → the decision → the consequence → the lesson left
unsaid.

Rules:
- The lesson must not be stated. Stating it converts a story into a case study,
  which is not what this archetype is for.
- One decision. Stories that make three turns are anecdotes.

## `question`

Structure: hook → the question → why the answer matters → where to answer → CTA.

Rules:
- The question must be one the reader can actually answer without a follow-up.
  "How do you handle automation?" cannot be answered. "What is the first thing
  you automate when nothing is documented?" can.
- `forbidden` phrases from `offers.cta_policy` still apply.

## `announcement`

Structure: hook → what changed → what it means for the reader → CTA.

Rules:
- Only about the person: a role, a new method, a result. Never a product
  release, never an event plug.
- If the reader's life is unchanged by it, do not post it.

---

## Choosing

`gen-calendar.mjs` chooses. A human choosing manually should apply:

| Evidence available | Use |
|---|---|
| Nothing new | `framework`, `how_to`, `opinion` at claim level 1 |
| One anecdote | `story`, `observation` at claim level 2 |
| One sourced result | `case_study`, `myth_busting` at claim level 3 |
| Two+ sourced results, tested | `case_study` at claim level 4 |

Claim level ceiling comes from `rubric/brand-consistency.yaml` → `claim_ladder`.
Exceeding it is a hard block, not a style note.