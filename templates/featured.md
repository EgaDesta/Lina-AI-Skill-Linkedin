# Featured Section

Five slots. `score-profile.mjs` `cm6` requires all five filled. Empty slots are
worse than unused ones because they are visibly empty to every visitor.

## What belongs in each slot, in priority order

| Slot | Content | Why |
|---|---|---|
| 1 | **Case study** | `ps3` requires one here. Highest-value asset on the profile. |
| 2 | **The offer** | `cv3` requires it. Somewhere to act on interest. |
| 3 | **The method** | The named approach as a readable artefact. |
| 4 | **Free resource** | The ladder rung 2 item. |
| 5 | **Credentials or third party** | A certificate, a publication, someone else's write-up. |

Reorder once slots 1 and 2 are filled. Slots 1 and 2 carry almost all of the
weight.

## Entry types

**Case study.** Title in the form `[metric] for [subject type]: [what happened]`.
Example: `Cutting invoice processing 6h to 40min for a 12-person finance team`.
Body: situation, intervention, result, in about 600 words or 8 bullet points.
Include the baseline. Include what did not work.

**The offer.** One page. What it is, who it is for, who it is not for, how it
runs, what it costs, what they get at the end. "Who it is not for" is the section
that makes the rest believable.

**The method.** The named approach, written up. This is what makes the method
real rather than a phrase in a headline. It also gives you something to point at
when someone asks what you do.

**Free resource.** The checklist, template, or guide referenced by the most posts.
Pick the one the audience asks for most. If the answer is "none yet", the honest
version is the method write-up, not a lead magnet nobody wants.

**Third party.** A certification, a publication, a client's recommendation with
permission. Strongest when it is someone the audience already respects.

## Rules

- Every entry needs a real, working URL. `cv4` fails placeholder destinations.
- Description under 300 characters. It shows in the preview.
- One idea per entry. Two case studies in one entry reads as a menu.
- Images: 1184x627 for articles, 1120x119 for portraits. Keep text out of the
  image; the title field is where text belongs.
- Order by strength, not by date. A recent weak entry below an old strong one is
  the wrong call.

## The empty-profile case

With no proof and no assets, the honest fills are:

1. A short process description: what you do, in what order. This is publishable
   with zero unsourced claims.
2. A short post you wrote that captures your position.
3. A description of your method with no outcome claims attached — the process,
   not the results.
4. A link to something you have genuinely published, even externally.
5. An honest one-liner: `Writing about [method] while I build it out.`

That scores worse on `ps3` and `cv3` than fabricated case studies would score,
and it is the correct outcome. `rubric/severity.md` exists partly to stop
exactly this trade.

## Checking

```bash
node scripts/score-profile.mjs --file data/examples/<slug>.json --json
```

`ps3` case study present, `cm6` five slots, `cv3` offer pointed at, `cv4`
destination resolves. Four mechanical checks, no judgement needed.