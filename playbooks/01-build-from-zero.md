# Playbook 01 — Build from zero

For a profile that is empty, or nearly. The order matters: each step produces
input the next one needs, and skipping forward produces a profile that has to be
redone.

Before starting: `node scripts/validate-persona.mjs`. If it reports blocking
gaps, stop — there is nothing to build a profile around yet.

---

## Step 1 — Position

Not a profile step. A thinking step, and the one that determines everything else.

Answer in writing, in `persona/positioning.yaml`:

- **Who exactly?** One job title. Not "founders" — "first-time SaaS founders with
  no ops hire yet".
- **What painful thing?** In their words, not yours. Interview two people from the
  segment or read their posts.
- **What is the method?** The named, repeatable approach. If you do not have a
  name for it, you do not have a method yet.
- **What is the outcome?** With a number.
- **Why you over the alternatives?** Not credentials. A position.
- **What do you have to prove?** Three claims. Fill `proof.yaml` with the tier for
  each: `verified`, `observed`, or `anecdotal`.

```
node scripts/validate-persona.mjs
```

Until this returns no blocking gaps, do not continue.

## Step 2 — Custom URL

`linkedin.com/in/<name>-<domain>`. Do it first. It takes two minutes and it is
harder to change once used in an email signature.

`cm4` checks it. A numeric default URL is a permanent small loss.

## Step 3 — Photo

Not scored. Human judgement. The only mechanical requirements:

- Square, cropped to head and shoulders
- Plain or near-plain background
- Recognisable as a thumbnail at 40px — this is the real test
- Face occupying 60-70% of the frame

Do not use a group photo cropped. Do not use a logo. Do not use a photo from
five years ago.

## Step 4 — Banner

See `templates/banner-brief.md`. Left third: message under 8 words. Right third:
URL. Centre empty.

Not scored beyond presence (`cm1`).

## Step 5 — Headline

`prompts/write-headline-about.md`. Generate 5 candidates plus one uncomfortable
keyword-free option. Pick one yourself — that is a position decision.

Verify: `pc1`, `pc2`, `pc3`, `pc5`, `rb1`.

## Step 6 — About

`prompts/write-headline-about.md`, skeleton chosen by `positioning.differentiator`.

Verify: `pc4` (no biography opening), `pc5`, `pc6`, `rb2`–`rb4`, `cv1`.

Then read only the first 210 characters. If they do not explain what this
account is to someone who has never met you, rewrite. Do not show the rest to
anyone until the opening works.

## Step 7 — Experience

Three roles minimum (`cm4`). Per role:

1. Reverse-derive from `templates/experience.bullets.md`: what was broken, what
   changed, what is different now, what is still not fixed.
2. Write three bullets per role, all with numbers.
3. `ps2` requires 60% of bullets per role to contain a digit. Aim for 100%.

Newer roles may have fewer bullets. Zero bullets on a role reads as an omission,
which is worse than a thin one.

## Step 8 — Education, licenses, credentials

`cm5`. Add anything real and relevant. Skip anything you would not put on a CV.

## Step 9 — Featured

`templates/featured.md`. Five slots (`cm6`). Case study in slot 1, offer in slot
2.

With no proof yet, use the empty-profile fills in that file. They score lower and
they are honest.

## Step 10 — Skills

`templates/skill-stack.md`. Three pinned matching the headline (`sc3`), then
10–15 more.

## Step 11 — Contact and offer

`cm7`, `cv2`, `cv4`. The offer needs a name, an outcome, and a price model in
`persona/offers.yaml`. This is a hard blocker on the whole profile.

## Step 12 — Custom button and creator mode

Not scored. Add when there is something to point at.

Creator mode only if you will post at least weekly. An activated creator mode
with four posts from 2024 is worse than inactive.

## Step 13 — Publish the first three posts before anything else

Not the other way round. A profile with nothing on it gets no inbound, so the
headline has nothing to be tested against.

## Step 14 — Audit

```bash
node scripts/score-profile.mjs --file data/examples/<slug>.json --json
```

Then `prompts/audit-profile.md` for the interpretation.

Expect 60–75 on a first complete build with real proof. A score of 90 on an empty
profile means something has been invented.

---

## Human review, not scored

Photo, banner, headline persuasiveness, Featured asset quality. The rubric
deliberately leaves these out — see `rubric/severity.md`, "What never appears in
a report". A human decides these.