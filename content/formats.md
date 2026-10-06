# Formats

`score-post.mjs` scores text posts. Everything else needs a different artefact
and a different rubric target.

| Format | Body | Score as | Max length |
|---|---|---|---|
| Text | the post itself | `post-rubric.yaml` | 2000 chars |
| Carousel | `output/drafts/<id>-carousel.md` | see below | 10 slides |
| Document | long-form, posts as a link | `post-rubric.yaml` on the hook | 1500 chars |
| Poll | question + 4 options | `post-rubric.yaml` on the question | 280 chars |
| Repost with thoughts | your comment on someone else's post | `post-rubric.yaml` | 500 chars |
| Newsletter | own | `post-rubric.yaml` on the hook | 1300 chars |

## Text

900–2000 characters. Below 900 usually means the idea was not finished. Above
2000 the truncation point on mobile loses the ending, which is where the CTA and
the payoff live.

Paragraphs under 180 characters. One blank line between paragraphs. No markdown
— LinkedIn renders none of it, and `ff3` fails the post for containing it.

## Carousel

Write a script, not a slide deck. The file format:

```
---
id: carousel-2026-01-08
title: The five-step review
pillar: p2
archetype: how_to
proof_refs: [p2]
---

SLIDE 1 — COVER
Headline under 8 words.
Subline optional, under 12 words.

SLIDE 2 — THE PROBLEM
One line.
Max 35 characters per line. Serif-free, no punctuation stacking.

SLIDE 3 ...
```

Rules:
- Cover headline under 8 words. It is seen at thumbnail size.
- One idea per slide. Two means neither is remembered.
- Under 35 characters per line. LinkedIn's carousel editor is unforgiving and
  readers on phones will not zoom.
- Final slide is the CTA. Not the thank-you slide everyone uses.
- Slides get read in order; the post body must not duplicate them. The post is
  the argument, the carousel is the artefact.

Score the carousel with `--format carousel`: the `hook` dimension applies to the
cover, `structure` applies to slide line length, `value_density` applies across
all slides. `specificity` is unchanged.

## Document

For when the idea needs 800 words and a diagram. The post is 3–5 sentences and
a link.

Do not split a document into five posts to avoid writing it. The five posts will
be worse than the document, and the argument will be lost.

## Poll

- Question under 280 characters.
- Exactly 4 options. Three reads thin, five reads like a quiz.
- Options under 40 characters each.
- Do not include the correct answer. The point is the responses.
- Follow the poll with a post 24–48 hours later using the responses as material.
  A poll without a follow-up is a wasted slot.

## Repost with thoughts

The only format where the persona borrows someone else's attention. 500
characters maximum — it appears as a comment under someone else's post.

- Must add something the original did not contain. Agreeing publicly adds nothing.
- Argue gently. You are a guest in their feed.
- No CTA. Asking for engagement in someone else's thread is how accounts get
  quietly unfollowed by readers.
- Credit the source. "Thanks for this" with no further content is empty.

## Newsletter

If it exists. The first two lines of a newsletter email decide everything, so the
hook rubric applies to them with no adjustment.

## Choosing

| Reader state | Format |
|---|---|
| Does not know they have the problem | Text, Diagnostic pillar |
| Knows, does not know the method | Carousel |
| Knows the method, wants depth | Document |
| Wants to be consulted | Poll |
| Considers you adjacent to someone | Repost with thoughts |
| Already subscribed | Newsletter |

## Media

Images and video are handled outside Lina. Lina generates the brief:

```
kind: single image
ratio: 1.91:1
text on image: under 7 words
must not contain: faces, stock photography, text longer than one line
alt text: the full sentence the image replaces
```

`alt text` is not optional. It is read by screen readers and by LinkedIn's own
search, and it is the only version of your words that always shows.