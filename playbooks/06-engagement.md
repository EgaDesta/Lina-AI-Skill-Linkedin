# Playbook 06 — Engagement

Distribution and relationship. Not scored by the rubric, because none of it is
measurable in advance. This is the work that decides whether the content in
`playbooks/05-post-compose.md` reaches anyone.

## The ordering that matters

Engagement amplifies content that already works. It does not rescue content that
does not. In order of return per minute:

1. **Comments on other people's posts** — highest by a wide margin
2. **Responding to comments on your own posts** — nobody else does this
3. **DMs with a real reason** — slow to build, high close rate
4. **Connection requests** — near zero on their own
5. **Reposts** — only with something to add

## Comments on other people's posts

`prompts/engagement-comment.md`. Five or ten a week, well under the rate limit.

The prompt returns `null` often. That is correct. A comment with nothing specific
to add costs credibility on a profile where the rest is credible.

**Who to comment on.** `audience.segments[].role_titles`, searching for people
who post about the segment's problems repeatedly. Peers, not celebrities.
Engagement with accounts twenty times your size gets read and ignored.

**What good looks like.** Their sentence, quoted, then the one specific thing
this persona knows. 40–90 words. Disagreement is worth more than agreement,
because agreement is what everyone else already left.

## Responding to comments on your own posts

The most underused activity on LinkedIn. Within two hours, from the person who
commented, with substance.

- Answer the question asked
- Never repost the comment's content as if it were yours
- If someone posts a substantive disagreement, answer it fully and thank them
  in the same reply. Others are watching how disagreement is handled, not only
  whether it happens

## DMs

Only with a reason, and only after some public interaction exists.

In order of legitimacy:

- A question about something you wrote
- A follow-up of a real conversation
- A specific resource they asked for — `offers.ladder[2]`, not rung 4

Never: a cold pitch, a calendar link, or a DM that is the contents of your About
section.

If they ask what you do, one sentence from `paid_offers[0].outcome`. No pitch.
If they ask for a call, that is what rung 4 is for.

## Connection requests

`templates/dm-invite.md`.

Practical limits from `neo-linkedin-profile-boost`:

- Personalised notes: roughly 2 per week before the Premium upsell
- 3rd and 4th degree: Connect button absent. Filter People search by the 2nd
  degree facet
- Roughly 2 connects per automation run before page changes rate-limit

Filter by role title and industry from `audience.segments[].role_titles` and
`industries`. Not whoever the search returned.

## Reposts

Only when you add something the original lacks. A repost with your thoughts on
someone else's post reaches their audience, not yours — which is why it is worth
doing and why the comment prompt has no CTA.

## Hashtags to follow

`keywords.yaml` `hashtags.core` and `hashtags.supporting`. Following them is a
legitimate discovery strategy and it costs nothing.

## What this does not produce

Reach metrics. Anyone promising engagement tactics produce reach metrics is
guessing. The honest measurement is in `07-analytics-review.md`, from LinkedIn's
own numbers, after the fact.

## Weekly

Ten comments. Every substantive reply on your own posts. DMs only where there is
a reason. Two connection requests with notes if the quota allows.

That is about two hours. Consistency matters more than volume: a person who
comments well every week for a year is recognised, and a person who comments
fifty times in one week is ignored.