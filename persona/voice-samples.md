# Lina — Voice Samples
#
# ## Why this file exists
#
# Everything else in `persona/` describes Lina. This file is the only place
# that shows Lina. A voice config with no samples behind it is a theory.
# check-voice.mjs uses these as the ground truth: it compares every draft's
# measurable style — sentence length distribution, word class mix, punctuation
# habits, paragraph shape — against the aggregate of these posts.
#
# ## How to fill it
#
# 1. Write 3-10 posts the way you would write them if nobody were analysing it.
#    Do not write them to fit the config. The config is derived from these.
# 2. Paste each into a `## Sample N` block below, raw. Line breaks as written.
# 3. Run `node scripts/validate-persona.mjs` — it reports the measured profile
#   (mean sentence length, variance, you/I ratio, emoji count, hashtag count)
#   and tells you which values in `voice.yaml` disagree with the samples.
#   **Where the samples and the config disagree, the samples win.** Fix the config.
# 4. These samples are also the reference set for the rewrite prompt: Lina's
#   drafts get diffed against them for repetition, which is the mechanism that
#   catches "AI wrote five posts using the same opening sentence".
#
# Do not publish anything from this file directly. They are calibration input.

---

## Sample 1

<!-- Replace. Aim for 1200-2000 characters, the same as a real post. -->

---

## Sample 2

---

## Sample 3

---

## Sample 4

---

## Sample 5