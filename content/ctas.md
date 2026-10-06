# CTA Library

One CTA per post. `offers.cta_policy.max_ctas_per_post` is enforced by
`score-post.mjs` check `ct1`. Multiple asks get the cheapest response of all the
asks, which is none.

The CTA must appear after the value is delivered (`ct2` — measured position
ratio must exceed 0.6 of the post length).

## Forbidden

`offers.cta_policy.forbid` is enforced by `score-profile.mjs` (`cv1`).
These get the lowest-effort reply, or the reply that is not worth having:

- thoughts
- agree?
- anyone else
- let me know below
- drop a comment
- like and share
- follow for more

---

## Soft asks — end of a Diagnostic or Observation post

The reader is still forming the problem. Ask for recognition, not commitment.

- `Does that match what you see, or is it worse somewhere I have not looked?`
- `Which of those has cost you the most time this year?`
- `I am wrong about something here. Tell me what.`

## Specific asks — end of a How-To, Framework or Checklist post

The reader got something usable. Ask for the next small step.

- `What is the first of these you would change on Monday?`
- `If you do one of these this week, tell me which and I will go deeper on it.`
- `I will write up the full version of this if there is interest. Say so and I will.`

"Full version if there is interest" is an acceptable way to qualify demand: it
gives the reader something useful now, and the interested ones self-identify.

## Proof asks — end of a Case Study post

- `What does your version of this look like? I am collecting patterns.`
- `If you have tried this and it did not work, I want to hear why.`
- `The numbers here are from one team. Tell me if they do not generalise.`

The last one is worth using more than it looks. Inviting disconfirmation reads as
confidence, and it also surfaces real objections you can address.

## Conversation asks — end of an Opinion or Story post

- `What is the version of this you have seen?`
- `Would you have made the same call? Genuinely asking.`
- `Am I wrong? Tell me the part that is.`

## Off-platform asks — when the ladder requires a rung

`offers.ladder[].cta_destination` must be `url`, `comment`, or `dm`. Placeholder
destinations are caught by `score-profile.mjs` (`cv4`).

- `If you want the template, the link is in the comments.`
- `I am writing up the full version. DM me and I will send it when it is done.`
- `Full breakdown, including the numbers: link in the first comment.`

Publishing a URL in the body is fine. Putting it in the first comment is worth
doing sometimes because the post gets one more distribution pass when the author
comments. That is a real effect, not a trick — but it only works once.

## Rung discipline

`offers.yaml` ladder, enforced by `gen-calendar.mjs`:

| Rung | Kind | Asks for | Appears in |
|---|---|---|---|
| 1 | content | nothing but a reaction | Diagnostic, Observation, Opinion |
| 2 | resource | a URL or DM | How-To, Framework, Checklist |
| 3 | community | membership or participation | Story, Question |
| 4 | call | a conversation | Case Study — **requires proof** |
| 5 | audit | an assessment | Case Study, Observation — **requires proof** |

Rungs 4 and 5 must never appear in a post that has not already demonstrated
something. Selling the call before the proof is the fastest way to lose the
audience the ladder was built to attract.

## Test

A CTA passes if the reader knows exactly what to do next and how long it takes.
If it needs a second read, rewrite it.