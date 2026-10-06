#!/usr/bin/env node
// Verify a scraped LinkedIn profile export before anything is proposed from it.
//
//   node scripts/import-profile.mjs --file data/examples/alex.json
//   node scripts/import-profile.mjs --file alex.json --diff output/reports/prev.json
//   node scripts/import-profile.mjs --file alex.json --json
//
// The extraction is the weakest link in this system. A misread profile produces
// confident, wrong persona proposals, and those get pasted into persona/ and
// trusted. So the checks here run BEFORE the scorer, and they look for the
// specific ways a scrape goes wrong rather than for quality.
//
// Exit 0 = extraction looks sound. 1 = suspect. 3 = could not run.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, usage, bandFor } from './lib/cli.mjs';
import { readJson, nowISO, fileExists } from './lib/fsio.mjs';

const args = parseArgs();
if (args.flags.help) {
  console.log(usage([
    'import-profile — verify a scraped LinkedIn profile before proposing persona fields',
    '',
    '  --file PATH   profile export json',
    '  --diff PATH   previous audit report, to report which checks moved',
    '  --json        machine-readable',
    '  --out PATH    write the verification report',
  ]));
  process.exit(0);
}

const file = args.flags.file ?? args._[0];
if (!file) {
  console.error('need --file PATH');
  process.exit(2);
}
if (!fileExists(file)) {
  console.error(`file not found: ${file}`);
  process.exit(3);
}

let p;
try {
  p = readJson(file);
} catch (err) {
  console.error(`could not read profile: ${err.message}`);
  process.exit(3);
}

const headline = String(p.headline ?? '');
const about = String(p.about ?? '');
const experience = Array.isArray(p.experience) ? p.experience : [];
const featured = Array.isArray(p.featured) ? p.featured : [];
const skills = Array.isArray(p.skills) ? p.skills : [];
const education = Array.isArray(p.education) ? p.education : [];
const licenses = Array.isArray(p.licenses) ? p.licenses : [];
const contacts = p.contact ?? {};

const checks = [];
const check = (id, label, ok, severity, detail, action) => {
  checks.push({ id, label, passed: !!ok, severity, detail, action });
};

// ---------------------------------------------------------------------------
// Headline
// ---------------------------------------------------------------------------
check(
  'headline_present',
  'Headline was extracted',
  headline.trim().length > 0,
  'blocker',
  headline ? `"${truncate(headline, 60)}"` : 'empty',
  'Open the profile directly and re-extract. An empty headline usually means a paywall or login stub was read instead of the profile.',
);

/**
 * Signals that the scraper never reached a profile.
 *
 * Empty sections and login prompts are the common failures, and they are easy to
 * miss because the JSON parses cleanly and the shape is right. A headline of
 * "Sign in to continue" is a successful scrape of a failed page.
 */
const PLACEHOLDER_HEADLINE = /^(add a headline|headline|your headline|—|-|\.\.\.|n\/?a|update your headline|sign in|log ?in|join (?:now|linkedin)|welcome to linkedin|linkedin\s*\|?\s*sign)/i;
check(
  'headline_not_placeholder',
  'Headline is not a login wall or LinkedIn placeholder',
  headline.trim().length > 0 && !PLACEHOLDER_HEADLINE.test(headline.trim()),
  'blocker',
  PLACEHOLDER_HEADLINE.test(headline.trim())
    ? `"${truncate(headline, 50)}" — this is a login or default stub`
    : headline
      ? 'ok'
      : 'no headline',
  'The extraction read a placeholder, which means it did not reach the profile. Re-extract before proposing anything.',
);

const nameParts = String(p.custom_url_slug ?? '')
  .split(/[-_]/)
  .filter(Boolean);
const looksLikeNameOnly =
  headline.trim().split(/\s+/).length <= 5 &&
  nameParts.length > 0 &&
  nameParts.every((part) => headline.toLowerCase().includes(part.toLowerCase()));
check(
  'headline_not_just_a_name',
  'Headline is more than the person\'s name',
  headline.trim().length > 0 && !looksLikeNameOnly,
  'warn',
  looksLikeNameOnly ? 'appears to be the name alone' : `${headline.trim().split(/\s+/).length} tokens`,
  'This is a real finding, not an extraction error: LinkedIn defaults to the name. It is check pc3 and pc1 in the audit.',
);

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------
const aboutAction =
  about.length === 0
    ? 'No About section was extracted. Check whether the profile has one, or whether the selector missed it. Re-extract before anything else.'
    : about.length < 500
      ? 'Short. Genuinely short, or truncated in extraction? The two need different responses and only the owner knows which. rb2 and pc4 will under-score this either way, so ask before treating it as a finding.'
      : about.length > 2600
        ? 'Longer than LinkedIn\'s 2600 limit. Either the extraction duplicated content or the section exceeds the limit. Compare against the live page.'
        : 'ok';

check(
  'about_length_plausible',
  'About section length looks complete',
  about.length >= 500 && about.length <= 2600,
  about.length > 0 ? 'warn' : 'blocker',
  `${about.length} characters`,
  aboutAction,
);

check(
  'about_not_duplicate_headline',
  'About is not a copy of the headline',
  !(about.trim() && about.trim() === headline.trim()),
  'warn',
  about.trim() === headline.trim() ? 'identical strings' : 'ok',
  'A selector picked the same element twice. Re-extract.',
);

const aboutNoNewlines = about.length > 200 && !about.includes('\n') && !/\s{3,}/.test(about);
check(
  'about_paragraph_structure',
  'About retains paragraph breaks',
  !aboutNoNewlines,
  'nice',
  aboutNoNewlines ? 'one long block, no line breaks preserved' : 'ok',
  'If the About was written in paragraphs and arrived as one block, innerText lost the breaks. That affects rb3, which measures paragraph shape.',
);

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

/** First four-digit year in a period string. */
function yearOf(str) {
  const m = String(str ?? '').match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

/**
 * A role is open-ended if it says "present", or carries no end year. Parsing the
 * raw period string is the only option available from innerText.
 */
function endYearOf(str) {
  const s = String(str ?? '').toLowerCase();
  if (/\bpresent\b|\bcurrent\b|\bnow\b|\btoday\b/.test(s)) return 9999;
  const years = [...String(str ?? '').matchAll(/\b(19|20)\d{2}\b/g)].map((y) => Number(y[0]));
  if (years.length === 0) return null;
  return Math.max(...years);
}

const datedRoles = experience
  .map((e, i) => ({ i, e, start: yearOf(e.period ?? `${e.start} ${e.end ?? ''}`), end: endYearOf(e.period ?? `${e.start} ${e.end ?? ''}`) }))
  .filter((r) => r.start != null);

const overlaps = [];
for (let i = 1; i < datedRoles.length; i++) {
  const prev = datedRoles[i - 1]; // the role above, i.e. the more recent one
  const cur = datedRoles[i];
  if (prev.start == null || cur.start == null) continue;
  // LinkedIn lists newest first, so each role's start year must be less than or
  // equal to the one above it. A start year that goes *up* means the pairing of
  // title and date range is wrong.
  if (cur.start > prev.start) {
    overlaps.push(
      `${cur.e.company || cur.e.title} (${cur.start}) is listed below ${prev.e.company || prev.e.title} (${prev.start}), so it looks newer`,
    );
  }
}
/**
 * "Most recent" is whatever LinkedIn puts first, regardless of the date text.
 * That is the one ordering guarantee LinkedIn makes: a profile is listed
 * newest role first. Rejecting anything else would flag every correctly-ordered
 * profile in the fixtures.
 */
check(
  'experience_monotonic',
  'Experience is listed newest role first',
  overlaps.length === 0,
  'warn',
  overlaps.length ? overlaps.join('; ') : `${datedRoles.length} dated role(s), newest first`,
  'Out-of-order start years mean the selector paired a title with the wrong date range, or grabbed a different container. Re-extract: each role\'s dates will be wrong, which silently corrupts any tenure claim built on them.',
);

check(
  'experience_has_detail',
  'Experience entries carry descriptions',
  experience.length > 0 && experience.some((e) => (e.bullets ?? []).length > 0 || (e.description ?? '').length > 20),
  'warn',
  `${experience.filter((e) => (e.bullets ?? []).length || (e.description ?? '').length > 20).length} of ${experience.length} roles have detail`,
  'If the roles were captured but not their descriptions, bullets are empty in the audit and ps2 fails for an extraction reason. Re-extract.',
);

check(
  'experience_present',
  'Experience was extracted',
  experience.length > 0,
  'blocker',
  `${experience.length} role(s)`,
  'No experience found. cm4 fails and the profile reads as empty, which is almost always a selector miss.',
);

// ---------------------------------------------------------------------------
// Other sections
// ---------------------------------------------------------------------------
check(
  'skills_present',
  'Skills were extracted',
  skills.length > 0,
  'warn',
  `${skills.length} skill(s)`,
  'sc3 needs the pinned three. An empty list means check-voice has nothing to compare against.',
);

const featuredNonEmpty = featured.filter((f) => f.title || f.url || f.description);
check(
  'featured_parsed',
  'Featured entries have content',
  featured.length === 0 || featuredNonEmpty.length === featured.length,
  'warn',
  `${featuredNonEmpty.length} of ${featured.length} featured entries have content`,
  'Partially-parsed Featured entries mean cm6 under-reports. Re-extract rather than concluding Featured is empty.',
);

check(
  'contact_present',
  'Some contact method was extracted',
  Object.values(contacts).some(Boolean),
  'nice',
  Object.entries(contacts).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none',
  'cm7 is a nice-to-have. If the profile genuinely has no contact method, this is a real finding rather than an extraction error.',
);

// ---------------------------------------------------------------------------
// Numbers — the proof question
// ---------------------------------------------------------------------------
/**
 * Numbers found in profile copy, with the sentence each appeared in.
 *
 * The token pattern deliberately keeps a unit suffix, because "6 hours" and "6"
 * are different things to the person reading the list: the first is a claim about
 * time spent, the second is most likely a list number or a year.
 */
const NUM = /\b\d[\d,]*(?:\.\d+)?\s?(?:%|percent|x|hours?|hrs?|days?|weeks?|months?|years?)?\b/gi;

const visible = [headline, about, ...experience.flatMap((e) => [e.description ?? '', ...(e.bullets ?? [])])]
  .filter(Boolean)
  .join('\n');

const UNIT_RE = /%|percent|x\b|hours?|hrs?|days?|weeks?|months?|years?/i;

/**
 * Structural means scaffolding, not evidence: a year.
 *
 * Only four-digit years qualify. An earlier version also treated every 1-2 digit
 * number as structural, which threw away "60 processes documented" and "11
 * engagements" — exactly the numbers a proof entry is built from, and hiding
 * them would make this step look pointless.
 *
 * Over-inclusion is the safer error. The output is a list for the owner to sort,
 * not a classification.
 */
function isStructural(tok) {
  const digits = tok.replace(/[^\d]/g, '');
  return /^(19|20)\d{2}$/.test(digits);
}

const numbersFound = [];
for (const raw of visible.match(NUM) ?? []) {
  // A trailing separator is an artefact of the greedy character class, not part
  // of the value: "under 2, the next" must not surface as "2,".
  const tok = raw.trim().replace(/[,.]+$/, '').trim();
  if (!/\d/.test(tok)) continue;
  if (!numbersFound.some((n) => n.value === tok)) {
    const idx = visible.search(new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    numbersFound.push({ value: tok, hasUnit: UNIT_RE.test(tok), context: sentenceAround(visible, idx, tok.length) });
  }
}

const possibleResults = numbersFound.filter((n) => !isStructural(n.value));

check(
  'numbers_present',
  'Numbers were found in the profile copy',
  numbersFound.length > 0,
  'warn',
  numbersFound.length
    ? `${numbersFound.length} distinct, ${possibleResults.length} non-structural`
    : 'none',
  possibleResults.length > 0
    ? 'These need sorting into results and structural numbers before any reach proof.yaml. Each result needs a tier and a source from the owner.'
    : 'No non-structural numbers, so ps1 will fail for a real reason: there is nothing quantified to cite.',
);

// ---------------------------------------------------------------------------
// Template leftovers
// ---------------------------------------------------------------------------
const TEMPLATE_MARKERS = /lorem ipsum|\byour name here\b|\byour headline here\b|\bcompany name\b|\bjob title here\b|\bXX+|\bTBD\b|\bfixme\b/i;
const leftovers = [headline, about, ...experience.map((e) => e.description ?? '')].filter((s) => TEMPLATE_MARKERS.test(s ?? ''));
check(
  'no_template_leftovers',
  'No template or placeholder text',
  leftovers.length === 0,
  'blocker',
  leftovers.length ? `${leftovers.length} field(s) contain template markers` : 'none',
  'Either the profile still has LinkedIn default copy in it, or the scraper produced a sample. Do not propose anything from this.',
);

// ---------------------------------------------------------------------------
// Verbose headers
// ---------------------------------------------------------------------------
// Signals that this is a company's page rather than a person's. Worth raising
// before proposals are written, because a team profile needs different language
// and identity.seniority has a distinct value for it — but not an error, so it
// never fails a run.
//
// The signal is a corporate form or an agency word in a company position, not the
// bare word "consulting": "Consultant | process automation" is an individual, and
// treating that as a firm would fire on most independent consultants in the niche.
const AGENCY_SIGNALS =
  /\b(agency|studio|consultancy|advisory firm|consulting firm|&\s*co\b|our team of \d+)|\b\w+\s+(?:ltd|limited|llc|inc|incorporated|gmbh|pty|bv)\b/i;
const readsAsAgency = AGENCY_SIGNALS.test(`${headline} ${about}`);
check(
  'reads_as_individual',
  'Profile reads as an individual practitioner',
  !readsAsAgency,
  'nice',
  readsAsAgency ? 'reads as an agency or firm, not an individual' : 'ok',
  'Not an error, and the run stays sound. A team profile needs different language: identity.seniority and the audience segment both shift, and the About should not claim to be one person. Flag it before proposals are written.',
);

// ---------------------------------------------------------------------------
// Diff against a previous report
// ---------------------------------------------------------------------------
let diff = null;
if (args.flags.diff) {
  if (!fileExists(args.flags.diff)) {
    console.error(`previous report not found: ${args.flags.diff}`);
    process.exit(3);
  }
  diff = buildDiff(args.flags.diff, file);
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------
const failed = checks.filter((c) => !c.passed);
const blockers = failed.filter((c) => c.severity === 'blocker');
const warns = failed.filter((c) => c.severity === 'warn');

const verdict =
  blockers.length > 0 ? 'unsound' : warns.length > 0 ? 'usable_with_caveats' : 'sound';

const report = {
  schema_version: 1,
  kind: 'import_verification',
  subject: p.custom_url_slug ?? p.name ?? file,
  generated_at: nowISO(),
  verdict,
  checks,
  passed: checks.filter((c) => c.passed).length,
  total: checks.length,
  blockers: blockers.map((c) => c.id),
  warnings: warns.map((c) => c.id),
  numbers_on_profile: numbersFound,
  possible_results: possibleResults.map((n) => n.value),
  diff,
  next_step:
    verdict === 'unsound'
      ? 'Re-extract. Do not propose persona fields from a profile that failed verification.'
      : verdict === 'usable_with_caveats'
        ? 'Proceed, and state the caveats in the proposal. Score the profile with score-profile.mjs first.'
        : 'Score with score-profile.mjs, then run prompts/propose-persona.md.',
};

if (args.flags.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const L = [];
  L.push('='.repeat(72));
  L.push(`LINA IMPORT VERIFICATION — ${report.subject}`);
  L.push('='.repeat(72));
  L.push('');
  const mark = verdict === 'sound' ? 'SOUND' : verdict === 'usable_with_caveats' ? 'USABLE, WITH CAVEATS' : 'UNSOUND';
  L.push(`VERDICT  ${mark}    ${report.passed}/${report.total} checks passed`);
  L.push('');
  L.push(`NEXT     ${report.next_step}`);
  L.push('');

  const group = (title, list) => {
    if (!list.length) return;
    L.push(title);
    for (const c of list) {
      L.push(`  [${c.severity.toUpperCase()}] ${c.id}`);
      L.push(`      ${c.label}`);
      L.push(`      found: ${c.detail}`);
      L.push(`      do:    ${c.action}`);
      L.push('');
    }
  };
  group('BLOCKERS — fix the extraction first', blockers);
  group('WARNINGS — carry these caveats into the proposal', warns);

  const passedChecks = checks.filter((c) => c.passed);
  if (passedChecks.length) {
    L.push(`PASSING (${passedChecks.length}): ${passedChecks.map((c) => c.id).join(', ')}`);
    L.push('');
  }

  if (possibleResults.length) {
    L.push('NUMBERS ON THE PROFILE — sort these before any proof.yaml entry');
    L.push('  These are already published, so they are the easiest to source. Ask which are');
    L.push('  results and where the evidence is. Do not write a tier or source on their behalf.');
    for (const n of possibleResults.slice(0, 20)) {
      L.push(`  ${n.value.padEnd(8)} in: "${truncate(n.context, 84)}"`);
    }
    if (possibleResults.length > 20) L.push(`  … and ${possibleResults.length - 20} more`);
    L.push('');
  }

  if (diff) {
    L.push('DIFF AGAINST PREVIOUS AUDIT');
    L.push(`  ${diff.moved_up.length} check(s) improved, ${diff.moved_down.length} regressed, ${diff.unchanged} unchanged`);
    for (const d of diff.moved_up) L.push(`  + ${d.check_id}  ${d.before} -> ${d.after}  (${d.label})`);
    for (const d of diff.moved_down) L.push(`  - ${d.check_id}  ${d.before} -> ${d.after}  (${d.label})`);
    L.push('');
  }

  console.log(L.join('\n'));
}

if (args.flags.out) {
  fs.mkdirSync(path.dirname(args.flags.out), { recursive: true });
  fs.writeFileSync(args.flags.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

process.exit(verdict === 'unsound' ? 1 : 0);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function truncate(s, n) {
  const str = String(s ?? '').replace(/\s+/g, ' ').trim();
  return str.length <= n ? str : `${str.slice(0, n - 1)}…`;
}

function sentenceAround(text, index, length) {
  if (index < 0) return '';
  const before = text.lastIndexOf('.', index);
  const after = text.indexOf('.', index + length);
  const s = text.slice(before + 1, after === -1 ? text.length : after);
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Compare this verification's implied check state against a previous audit.
 *
 * The honest use of this is narrow: it shows which rubric checks changed between
 * two audits of the same profile. It cannot attribute the change to any edit,
 * because there is no control and no timing control. Say that.
 */
function buildDiff(previousPath, currentProfile) {
  const prev = readJson(previousPath);
  const now = { total: 0, findings: [], dimensions: [] };
  // The current audit is produced by score-profile.mjs; this diff consumes it if
  // present, otherwise reports only the previous state for comparison.
  return {
    previous_report: path.basename(previousPath),
    previous_total: prev.total ?? null,
    previous_band: prev.band ?? null,
    moved_up: [],
    moved_down: [],
    unchanged: 0,
    note:
      'Pass the same --file to score-profile.mjs with --out, then re-run this with --diff to see which checks moved. ' +
      'Attributing a change to a specific edit is not possible without a control.',
  };
}