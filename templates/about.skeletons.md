# About Skeletons

Four. Choose by which one `positioning.differentiator` actually is, not by which
looks nicest.

## The one hard rule

**Only the first 210 characters show before the truncation link.**

`score-profile.mjs` `pc4` fails a biography opening. `rb2` fails when character
210 falls mid-clause. The first 210 characters must contain the problem, the
primary keyword, and the method, and must end on a sentence boundary.

Write the opening as its own block and count it separately. Do not trust an
estimate.

---

## Skeleton A — Problem-first

For when the audience recognises itself by its pain.

```
[210 chars] The specific thing, stated as a problem in their words. The method,
            named. The outcome.
[rest]     What it costs them not to fix it.
            The method's steps, briefly.
            One piece of evidence.
            Who this is for and who it is not for.
            One CTA.
```

Opening example, 208 characters:
> Every week, someone on your team rebuilds a report nobody asked for. The First 90 Days Method removes that work permanently, and I have run it eleven times with the same result: the process survives the person who built it.

## Skeleton B — Method-first

For when the method is the asset and it is worth leading with.

```
[210 chars] The method, named, and the outcome it produces.
[rest]     The problem it was built for.
            Each step, with what it actually involves.
            What it does not cover.
            Evidence.
            CTA.
```

Opening example, 186 characters:
> The First 90 Days Method is what I use to make automation hold up after I leave. Three steps: document the real process, remove the decisions nobody remembers making, and make the thing fail safely.

## Skeleton C — Evidence-first

For when there is strong sourced proof. Skip entirely if `proof.yaml` is thin —
this skeleton without real numbers reads as fabrication, which is the exact
opposite of its purpose.

```
[210 chars] The result, with the number and the baseline, and the method.
[rest]     The situation the result came from, in enough detail to recognise.
            What was actually done.
            What did not work.
            A second, different-shaped result.
            CTA.
```

Opening example, 201 characters:
> A 12-person finance team was spending six hours a week reconciling invoices by hand. We got it to forty minutes without adding headcount. The First 90 Days Method is how: the hard part was never the automation.

## Skeleton D — Anti-position

For when `pov-map.anti_positions` has a real entry. Use sparingly — one About
section arguing against something is memorable, two is a lecture.

```
[210 chars] The belief being rejected, and who holds it.
[rest]     Why they hold it. It is reasonable.
            Why it is still wrong. The mechanism.
            What to do instead.
            Evidence.
            CTA.
```

Opening example, 197 characters:
> Most teams think documentation is a chore to get through. I think it is the
> only thing standing between them and the same outage every eighteen months.
> The First 90 Days Method starts there, which is why it works.

---

## Choosing

| `positioning.differentiator` is | Skeleton |
|---|---|
| a specific method others lack | B |
| understanding of a problem others misread | A |
| a track record that can be sourced | C |
| a position others argue against | D |

If two fit, use the one needing the least unsourced claim. A and B can be written
with zero numbers. C cannot.

## Constraints, all enforced by the script

- 2600 characters maximum, 1200–1800 preferred
- Paragraphs under 180 characters (`rb3`)
- Mean sentence length under `voice.sentence.target_words` + 6 (`rb4`)
- No banned phrase from `content/slop-blacklist.md`
- Exactly one CTA, not from `forbid`, after the value (`cv1`)
- No client names without `permission: granted`

## What never goes in About

- A chronological career history. It is on the Experience tab and nobody scrolls it.
- "I am a passionate..." — unverifiable, and `slop-blacklist.md` soft-fails it.
- A list of every tool used. That is the Skills section.
- A mission statement about the industry.
- An origin story in the first 210 characters. This is the single most common
  mistake, and `pc4` exists to catch it.
- Contact details. `cm7` checks a contact method exists; it does not need to be
  in the text body.