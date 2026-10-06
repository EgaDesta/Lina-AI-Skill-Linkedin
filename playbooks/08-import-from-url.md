# Playbook 08 — Import from profile URL

Takes a LinkedIn URL and turns the live profile into three things: a scored audit,
a set of persona proposals, and a list of decisions only the owner can make.

The order matters. Extract and verify **before** proposing, because a proposal
derived from a misread profile is worse than no proposal — it will be pasted into
`persona/` and trusted.

---

## Step 1 — Extract

Given a URL from the user, open it in the agent browser and read the fields the
scorer needs. Use `integrations/browseros-neo.md` for the per-field selectors and
the failure modes.

Fields to capture, into `data/examples/<slug>.json`:

```
headline, about, experience[], featured[], education[], licenses[],
skills[], contact{}, custom_url_slug
```

Read them with `page.evaluate` per section, not one full-page dump. The full page
includes the nav, ads, and the "people you may know" carousel, and it truncates
before reaching the About section.

```js
const page = await browser.open(userUrl);
await page.waitForSelector('main');
const profile = await page.evaluate(() => {
  const txt = (sel) => document.querySelector(sel)?.innerText?.trim() ?? null;
  const all = (sel) => [...document.querySelectorAll(sel)];
  return {
    headline: txt('.top-card-layout__headline'),
    about: txt('.core-section-container__content p'),
    experience: all('.experience-item').map((el) => ({
      title: el.querySelector('.experience-item__title')?.innerText?.trim() ?? '',
      company: el.querySelector('.experience-item__subtitle')?.innerText?.trim() ?? '',
      period: el.querySelector('.experience-item__duration')?.innerText?.trim() ?? '',
      location: el.querySelector('.experience-item__location')?.innerText?.trim() ?? '',
      description: el.querySelector('.experience-item__description')?.innerText?.trim() ?? '',
    })),
    skills: all('.skills-list__skill-name').map((el) => el.innerText.trim()),
    education: all('.education-item').map((el) => ({
      school: el.querySelector('.education-item__subtitle')?.innerText?.trim() ?? '',
      field: el.querySelector('.education-item__degree')?.innerText?.trim() ?? '',
    })),
    licenses: all('.licenses__licenses-list-item').map((el) => ({
      name: el.querySelector('.licenses__license-name')?.innerText?.trim() ?? '',
      issuer: el.querySelector('.licenses__license-issuer')?.innerText?.trim() ?? '',
    })),
  };
});
```

**If the page shows a login wall, do not proceed.** Ask the user to sign in in
the agent browser (`request_human_help`, kind `login`). Never work around a login
or a CAPTCHA.

**If About is truncated on the page**, note it. A truncated About will score
against `rb2` for length reasons that are not the owner's fault, and the report
will send them to rewrite something that is merely hidden. Go to
`/in/<slug>/details/about/` for the full text.

## Step 2 — Verify the extraction before anything else

```bash
node scripts/import-profile.mjs --file data/examples/<slug>.json
```

This is the step that matters. It checks the extraction against rules that catch
the failure modes of scraping a profile, and prints a verdict per field. It exits
non-zero if anything is suspect.

| Check | Catches |
|---|---|
| `headline_present` | empty extraction, or a paywall/login stub read as a headline |
| `headline_not_placeholder` | "Add a headline", or the person's own name |
| `about_length_plausible` | truncated About, or an empty one |
| `about_not_duplicate_headline` | About and headline are the same string |
| `experience_monotonic` | overlapping or reversed date ranges — extraction order got confused |
| `experience_has_detail` | every role captured but no descriptions |
| `skills_present` | skills failed to load |
| `featured_parsed` | Featured entries present but all empty |
| `numbers_present` | no digits anywhere, so `ps1` and `ps2` will fail for the wrong reason |
| `no_template_leftovers` | lorem ipsum, "Lorem", "Your Name Here", sample copy |

Report the verdict before proposing anything. If `about_length_plausible` fails,
say so and ask whether the About is genuinely short or the extraction cut it off —
the two need different responses, and only the user knows which.

## Step 3 — Score the profile as it is

```bash
node scripts/score-profile.mjs --file data/examples/<slug>.json --out output/reports/profile-<slug>-<date>.json
```

Do this on the **unmodified** profile, before any persona exists. It gives the
before-picture and produces a concrete list of what is missing, which is what the
proposals have to address.

Expect a low score on a profile that has never been worked on. That is the
baseline, not a judgement of the person.

## Step 4 — Propose persona fields

`prompts/propose-persona.md` is the runtime prompt. It reads the extraction and
the audit, and proposes values for `identity.yaml`, `keywords.yaml`,
`audience.yaml`, and `pov-map.yaml`.

Rules that are not negotiable in that prompt:

- **Propose, do not fill.** Write to `output/reports/persona-proposal-<slug>.md`.
  Never edit `persona/*.yaml` from an import. The user chooses what to accept.
- **Every proposal cites its evidence.** "role_title: Operations Manager —
  from the current role title on the profile" is acceptable. "role_title:
  Operations Manager — typical for this field" is not.
- **Never propose a proof entry.** Not one number. `proof.yaml` is filled by the
  person who did the work, from their own records. See the next section.
- **Never propose a named client.** Generic subjects only.
- **Ask where the evidence is thin.** If the About is generic, the audience
  segment cannot be proposed confidently — say so rather than inferring from the
  job title alone.
- **Distinguish extracted from interpreted.** Job title is extracted. Seniority
  is interpreted. Label them.

## Step 5 — The proof question

This is where an import is most useful and most dangerous.

The profile contains numbers. Some are results; some are dates, durations, team
sizes, and job counts. An import cannot tell them apart reliably, and guessing
wrong puts invented evidence into the one file that exists to prevent that.

So:

1. `import-profile.mjs` lists every number found on the profile, with the
   sentence it appeared in.
2. The user sorts them into: a result worth claiming, or structural.
3. Each result becomes a `proof.yaml` entry **filled by the user**, with its tier
   and source. `validate-persona.mjs` blocks any entry without a source.

Never write a tier or a source on the user's behalf. "verified" means a document
exists that the user has checked; an importer cannot know that.

Numbers already on the profile are the *easiest* proof to source, because the
person already published them and can point to where. Say so — it lowers the bar
and makes the honest path feel easy rather than like a chore.

## Step 6 — Hand off

Give the user four things and nothing else:

1. The extraction verdict — clean, or what looked wrong
2. The audit score, with the top three fixes
3. The persona proposal file, ready to review
4. The proof question: these numbers are on your profile, which of them are
   results, and where is the evidence for each

Then stop. Do not continue into content generation until `validate-persona.mjs`
reports no blocking gaps. Writing content for an unpositioned profile amplifies
the wrong message to a wider audience.

---

## Re-running

Imports are cheap to repeat and worth repeating. When the profile changes:

```bash
node scripts/import-profile.mjs --file data/examples/<slug>.json --diff output/reports/profile-<slug>-<date>.json
```

The diff reports which checks moved, which is the only honest way to tell whether
an optimisation worked. Without a previous report, a score change is uninterpretable.

---

## What this playbook does not do

- **Publish.** No part of an import touches LinkedIn. Applying changes to the live
  profile is `playbooks/03-optimize.md`, separately, with verification between steps.
- **Write `proof.yaml`.** See step 5.
- **Guess the niche.** If the profile does not make it clear, ask. A guessed
  `domain` becomes a keyword nobody ever searches, and it is worse than an empty
  field because it looks filled.
- **Infer seniority from job title alone.** "Senior Consultant" is ambiguous, and
  the title is frequently aspirational. Propose, label it as interpreted, and let
  the user correct it.
- **Estimate analytics.** Profile views, impressions, search appearance. Lina has
  no data source. If the user asks how the profile is performing, say what is
  visible on the page and stop there.