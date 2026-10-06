# Changelog

All notable changes to this project. Format follows Keep a Changelog. Versions are
semver, and the **persona version** (`persona/identity.yaml` → `persona.version`)
is independent: a persona is a separate artefact from the code scoring it.

## [Unreleased]

### Added

- `scripts/import-profile.mjs` — verifies a scraped LinkedIn profile before any
  persona field is proposed from it. 15 checks against the specific ways a scrape
  fails: a login wall read as a headline, LinkedIn placeholder copy, a truncated
  About, roles paired with the wrong dates, partially-parsed Featured entries,
  leftover template text. Verdict is `sound`, `usable_with_caveats`, or `unsound`.
- `playbooks/08-import-from-url.md` — the URL-to-persona workflow, gated on
  verification, including the browser extraction recipe.
- `prompts/propose-persona.md` — proposes persona fields with per-field evidence
  labels, and refuses to write `proof.yaml` entries.
- `data/examples/sample-profile-rina.json` — a sound extraction fixture: a
  profile with real track record, correct ordering, four roles, three Featured
  entries, and numbers for the proof step to surface.
- `tests/test-import.mjs` — 19 tests using deliberately damaged fixtures, asserting
  the verdict flips.
- `SKILL.md` — agent router. Maps a request to a playbook and a command, and
  states the rules an agent must not break.
- `README.md` — what the repo is, why it is built this way, five-minute start.
- `AGENTS.md` — conventions and the rules that matter for automated work here.
- `docs/GETTING-STARTED.md` — a walkthrough with real captured output for each
  of the six commands, so the expected output is knowable before running anything.
- `docs/FILL-CHECKLIST.md` — the persona fields to fill, in dependency order, with
  what each one unlocks.
- `.gitignore`, `package.json`, `LICENSE` (MIT).

### Fixed

- **`import-profile.mjs` classified every 1-2 digit number as structural**, which
  discarded `60 processes documented` and `11 engagements` — exactly the numbers
  a proof entry is built from. Only four-digit years qualify now. Over-inclusion
  is the safer error: the output is a list for the owner to sort, not a
  classification.
- **`experience_monotonic` rejected correctly-ordered profiles.** It required each
  role to start before the one above it *ended*, which no real profile satisfies.
  It now checks the one ordering guarantee LinkedIn actually makes — newest role
  first — so it fires on a genuine extraction fault and stays silent otherwise.
- **The agency check fired on independent consultants.** It matched the bare word
  "consulting", which is most individual consultants' entire title. It now matches
  a corporate form (`Ltd`, `LLC`, `GmbH`) or an agency word in a company
  position.
- **The About-length message reported a finding the owner could not act on.** A
  short About is ambiguous between genuinely short and truncated in extraction;
  only the owner knows which, and the two need different responses. The message
  now asks.

## [0.1.0] — initial engine

### Added

**Persona as data.** Eight files under `persona/`: identity, audience, voice,
POV map, proof registry, offer ladder, keywords, voice samples. Ships empty on
purpose — Lina refuses to guess a niche, and a guessed persona is worse than none.

**Rubrics.** `profile-rubric.yaml` (100 points, 7 dimensions), `post-rubric.yaml`
(100 points, 5 hard blocks, grade bands), `brand-consistency.yaml` (rolling-window
drift thresholds, proof rotation, a 4-level claim ladder, 5 stop conditions),
`severity.md` (blocker/warn/nice semantics, score caps, report ordering).

**Engine.** Six CLIs, zero dependencies, Node 18+.

- `validate-persona.mjs` — completeness, cross-reference integrity, publish-gate
  sanity, and voice measured from `voice-samples.md`
- `score-profile.mjs` — profile audit with severity-ordered findings and top-three
  fixes
- `score-post.mjs` — draft scoring, reporting computed score and
  `judged_points_pending` separately
- `check-voice.mjs` — hard bans, soft tells, proof sourcing, and optional drift
  analysis over published history
- `gen-calendar.mjs` — pillar × archetype × claim level planner with plan-level
  violation reporting
- `export-queue.mjs` — approved posts to CSV for the Make pipeline

**Libraries.** `yamlmin.mjs` (YAML subset, throws on anything unimplemented),
`textstats.mjs` (sentence and paragraph analysis, n-gram overlap, style profiles),
`slop.mjs` (hard bans, soft tells, vague quantifiers, unsourced authority),
`persona.mjs` (assembly and gap detection), `fsio.mjs` (I/O and a JSON Schema
validator), `cli.mjs` (arg parsing, report rendering, ordering).

**Content system.** Five pillars, ten archetypes, ten hook families, a CTA
library, a three-tier slop blacklist, format specs, a calendar template.

**Playbooks.** Seven: build from zero, audit, optimize, content calendar, post
compose, engagement, analytics review.

**Prompts.** Five runtime prompts: generate post, rewrite post, audit profile,
write headline and About, engagement comment.

**Templates.** Eight formula files: headline formulas, About skeletons, experience
bullets, Featured, recommendations, banner brief, skill stack, connection note.

**Schemas.** JSON Schema for persona, post, audit report, and calendar.

**Fixtures and tests.** A complete filled persona at
`data/examples/sample-persona/`, a good and a bad post draft, a deliberately weak
profile, and 133 tests across five files.

### Fixed

Bugs found by the test suite while bringing the engine up. Each was a real
behavioural defect, not a test that needed loosening.

- **Hard blocks were computed but never printed.** `score-post.mjs` put them in
  `report.hard_blocks`; `renderReport` only looked for them on `findings`, so the
  section header never appeared. A post rejected for an unsourced claim showed a
  score of 0 with no stated reason, which is the least actionable report the tool
  can produce — the reader cannot tell whether to fix the post or the score.
- **A hard block listed every unsourced number in one unbroken paragraph.** Four
  numbers with their surrounding sentences ran together as a single line that
  wrapped into a wall, hiding the numbers that were the whole reason for the
  block. Each occurrence is now its own line, with a `wrapText` helper, a
  truncated quote of the sentence it came from, and an explicit `action`.
- **`slop.mjs` counted every phrase hit twice.** Phrase matching searched the
  normalised and raw text concatenated, so a phrase repeated three times reported
  six, and reported positions were only meaningful for occurrences in the first
  half of the text. Rewritten as a single locate-first-then-fallback search with
  contraction-tolerant matching.
- **`textstats.mjs` broke numbered and bulleted lists into fragments.** The
  sentence splitter cut after each `N.`, turning `1. Write the trigger down.` into
  a one-word fragment plus a clause. This skewed mean sentence length downward and
  hid the verb from imperative detection, which is exactly what check `vd1` asks
  about. List markers are now protected before splitting.
- **Imperative detection missed the archetypal how-to post.** It matched only
  bare leading verbs, so every numbered procedure scored zero actionable sentences.
  Now handles `N. verb`, `N) verb`, and bullet markers, and the verb list covers
  the actions a process post actually prescribes.
- **`gen-calendar.mjs` planned 100% `how_to` and then reported itself for
  violating the archetype ceiling.** The planner round-robined a fixed ordered list,
  which for any window smaller than the list length emitted the first archetype for
  every slot. Replaced with even apportionment, an interleave pass, and a spill
  pass that enforces the ceiling.
- **`gen-calendar.mjs --json` printed a human summary before the JSON.** A
  machine consumer had to strip a report off the front of the document. JSON mode
  now emits the document alone, with the exit code decided after all output.
- **`gen-calendar.mjs` crashed on CSV export.** `csvEscape` was referenced but
  never defined, so `--csv` failed at the last step.
- **`post.schema.json` accepted `queued` posts with no approval.** The bypass
  branch had `properties` but no `required`, so a post absent both `approvals` and
  `gate_bypassed` satisfied it vacuously. This was the one gap in the approval gate
  that let a post through without a human.
- **`persona.schema.json` and the shipped empty persona could not both be
  valid.** `minLength` and `pattern` constraints on `positioning` made the
  unfilled starter persona fail schema validation, reporting the same missing
  fields twice through two vocabularies. Completeness is now `collectGaps()` alone.
- **`check-voice.mjs` blocked numbers belonging to named entities.** "The First 90
  Days Method" was treated as an unsourced claim. That would push people to remove
  the name of their own method rather than source their results — the wrong
  incentive. Numbers in persona names, the domain, the slug and keywords are now
  treated as structural labels.
- **`validate-persona.mjs` ignored `LINA_PERSONA_ROOT`.** It defaulted to the repo
  root at the call site, overriding the env var that multi-brand installs and the
  test suite both depend on.
- **`score-profile.mjs` had a syntactically invalid check definition**, left over
  from a partial edit, and one unescaped apostrophe in a fix string.
- **`anyOf` failures reported only "no branch matched".** Now reports why each
  branch failed, so a schema rejection is diagnosable without reading the schema.

### Design notes

Decisions that are not obvious from the code, recorded here so they are not
accidentally reversed.

- **`judged_points_pending` is reported beside every score.** 31 of the post
  rubric's points are human judgement. Presenting a single total would invite it to
  be quoted without the caveat that it excludes them.
- **The profile rubric's "what this deliberately does not score" section is
  load-bearing.** Photo, banner and headline persuasiveness are not scored because
  no honest computation exists for them. A fake score is worse than an omission.
- **Score caps exist so excellence elsewhere cannot hide a fatal gap.** A profile
  cannot reach `strong` while missing the thing that makes it findable.
- **The approval gate is enforced in four places.** Schema, scorer, exporter and
  validator. Redundant on purpose: a single enforcement point is one careless edit
  from being bypassed, and publishing is irreversible.
- **`gen-calendar.mjs` may exit 1 on a valid plan** when it reports a warning
  violation. Read `violations`; do not assume the plan is broken.
- **`drift.max_ngram_overlap_any_pair` is calibrated for post-length text.**
  Jaccard overlap on 4-grams is size-dependent — the same edit on a 12-word
  sentence scores around 0.10, on a 200-word post around 0.70. The 0.25 threshold
  means something at the length it is applied to and nothing below it.

[Unreleased]: https://github.com/EgaDesta/Lina-AI-Skill-Linkedin/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/EgaDesta/Lina-AI-Skill-Linkedin/releases/tag/v0.1.0