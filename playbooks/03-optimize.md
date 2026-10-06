# Playbook 03 — Optimize

For applying specific changes to an existing profile. Playbook 02 finds the
problems; this one fixes them, one at a time, with verification between each.

## The loop

```
audit -> pick the highest blocker -> generate replacement -> verify -> apply -> re-score
```

One field at a time. Three changes in one session means you cannot attribute a
score movement to any of them, and you will not know which change helped.

---

## Optimizing the headline

```bash
node scripts/score-profile.mjs --file data/examples/<slug>.json --json | jq '.findings[] | select(.check_id | startswith("pc") or startswith("rb1"))'
```

Then `prompts/write-headline-about.md`.

Apply with `integrations/browseros-neo.md`. The headline is a plain text input —
one of the few fields that does not need the contenteditable workaround.

Verify: `pc1`, `pc2`, `pc3`, `rb1`.

Then search LinkedIn for `keywords.primary.keyword`. If the profile does not
appear in the first page, the keyword is not ranking. The script checks presence;
only the search checks rank.

## Optimizing About

The longest write. `templates/about.skeletons.md`.

Verify: `pc4`, `pc5`, `pc6`, `rb2`, `rb3`, `rb4`, `cv1`.

**Applying About needs the contenteditable path.** LinkedIn's About editor is a
ProseMirror instance where `fill()` and `type()` silently revert. The working
method:

1. Navigate to `/in/<slug>/edit/forms/summary/new/`
2. Wait for the `.ProseMirror` selector
3. `selectNodeContents(el)` then `execCommand('delete')`
4. `execCommand('insertText', false, aboutText)`
5. Click Save

Newlines become separate paragraphs. Verify the result by reading it back —
LinkedIn's editor occasionally drops a trailing paragraph.

## Optimizing experience bullets

`templates/experience.bullets.md`, reverse-derived rather than improvised.

Verify: `ps2`.

## Optimizing Featured

`templates/featured.md`. Reorder before adding. Slot 1 and slot 2 carry most of
the value.

Verify: `cm6`, `ps3`, `cv3`, `cv4`.

## Optimizing skills

`templates/skill-stack.md`. Pin three, then reorder 4–7.

Verify: `sc3`.

## Optimizing voice

```bash
node scripts/check-voice.mjs --file data/examples/<slug>.json
```

`pcx1` vocabulary, `pcx3` style similarity to `persona/voice-samples.md`.

If `pcx3` fails because there are no samples, add three posts to
`voice-samples.md`. It is the only way tone becomes measurable.

---

## Applying changes to the live profile

Every edit path is in `integrations/browseros-neo.md`. Two things that will bite:

- **An "Ad Options" interstitial appears after edits.** Dismiss it or every
  subsequent selector is wrong.
- **Verify by reading back, not by assuming.** The save button being clicked does
  not mean it saved. `neo-linkedin-profile-boost` records this.

## Applying changes without a browser

Edit the JSON in `data/examples/<slug>.json`, re-score, and use the JSON as the
source of truth for copy you paste in manually. This is slower and it is
completely reliable, which is a reasonable trade for the About section.

## What not to change

- **The avatar or banner** because you feel like it. Not measurable, and churn on
  these reads as instability.
- **Anything mid-audit-cycle** while measuring a score change.
- **A profile field the persona does not own a position on.** A `pov-map.beliefs`
  entry does not exist for it, so you cannot write it honestly.

## After optimizing

Re-score. Then check `not_scored` in the report and handle those by hand. The
script refuses to judge photo, banner, or whether the headline is actually
persuasive, and it is right to.