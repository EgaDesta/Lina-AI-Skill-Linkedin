#!/usr/bin/env node
// Score a LinkedIn profile against rubric/profile-rubric.yaml.
//
//   node scripts/score-profile.mjs --slug someone
//   node scripts/score-profile.mjs --file data/examples/sample-profile.json
//   node scripts/score-profile.mjs --file export.json --json
//
// The profile comes from data/examples/, a JSON export, or a live scrape via
// integrations/browseros-neo.md. This script never touches the network.
// Exit 0 = at or above --min, 1 = below, 3 = cannot run.

import { parseArgs, renderReport, usage, bandFor, orderFindings } from './lib/cli.mjs';
import { loadPersona, loadRubric, proofIndex, pillarById } from './lib/persona.mjs';
import { readJson, repoPath, writeJson, nowISO, fileExists } from './lib/fsio.mjs';
import {
  styleProfile,
  styleSimilarity,
  aggregateProfiles,
  charCount,
  wordCount,
  sentenceLengths,
  mean,
  longestParagraphChars,
  round,
} from './lib/textstats.mjs';
import { countOccurrences } from './lib/slop.mjs';

const args = parseArgs();
if (args.flags.help) {
  console.log(usage([
    'score-profile — audit a LinkedIn profile against the profile rubric',
    '',
    '  --file PATH   profile export json (see data/examples/sample-profile.json)',
    '  --slug NAME   read data/examples/<slug>.json',
    '  --min N       threshold for exit code (default 60)',
    '  --json        machine-readable',
    '  --out PATH    write the report json',
  ]));
  process.exit(0);
}

let persona;
try {
  persona = loadPersona();
} catch (err) {
  console.error(`cannot load persona: ${err.message}`);
  process.exit(3);
}
const rubric = loadRubric();
const pr = rubric.profile;
if (!pr) {
  console.error('rubric/profile-rubric.yaml not found');
  process.exit(3);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
let profile = null;
const file = args.flags.file;
if (file) {
  if (!fileExists(file)) {
    console.error(`file not found: ${file}`);
    process.exit(3);
  }
  profile = readJson(file);
} else if (args.flags.slug) {
  const p = repoPath('data', 'examples', `${args.flags.slug}.json`);
  if (!fileExists(p)) {
    console.error(`no example profile at ${p}`);
    process.exit(3);
  }
  profile = readJson(p);
} else {
  console.error('need --file PATH or --slug NAME');
  process.exit(2);
}

const headline = String(profile.headline ?? '');
const about = String(profile.about ?? '');
const experience = Array.isArray(profile.experience) ? profile.experience : [];
const featured = Array.isArray(profile.featured) ? profile.featured : [];
const education = Array.isArray(profile.education) ? profile.education : [];
const licenses = Array.isArray(profile.licenses) ? profile.licenses : [];
const skills = Array.isArray(profile.skills) ? profile.skills : [];
const contacts = profile.contact ?? {};

const idProfile = persona.identity?.profile ?? {};
const pos = persona.identity?.positioning ?? {};
const kw = persona.keywords ?? {};
const proof = proofIndex(persona);
const offers = persona.offers ?? {};

// Everything a reader actually sees, for vocabulary and voice checks.
const visibleText = [
  headline,
  about,
  ...experience.flatMap((e) => [e.title ?? '', e.company ?? '', ...(e.bullets ?? [])]),
  ...featured.map((f) => `${f.title ?? ''} ${f.description ?? ''}`),
].filter(Boolean).join('\n');

const aboutPreview = about.slice(0, 210);
const aboutProfile = styleProfile(about);
const allNumbers = (visibleText.match(/\b\d+(?:[.,]\d+)?\s?(?:%|percent|x|hours?|hrs?|days?|weeks?|months?|years?)?\b/gi) ?? []);

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------
const has = (needle, hay) => String(hay ?? '').toLowerCase().includes(String(needle).toLowerCase());
const num = (v) => (v == null ? 0 : v);

const results = {};
const define = (id, fn) => {
  results[id] = fn();
};

define('pc1', () => {
  const titles = [idProfile.role_title, ...(persona.audience?.segments ?? []).flatMap((s) => s.role_titles ?? [])].filter(Boolean);
  const hit = titles.find((t) => has(t, headline));
  return {
    pass: !!hit,
    measured: hit ?? (headline ? `"${headline.slice(0, 60)}"` : 'headline empty'),
    target: idProfile.role_title || 'a role title from persona',
    fix: { action: 'Open the headline with the role title buyers search for.', effort: 'trivial', source_template: 'templates/headline.formulas.md' },
    replacement: idProfile.role_title ? `${idProfile.role_title} | ` : null,
  };
});

define('pc2', () => {
  const primary = kw.primary?.keyword;
  return {
    pass: !!primary && has(primary, headline),
    measured: primary ? (has(primary, headline) ? `"${primary}" found` : `"${primary}" absent`) : 'no primary keyword set',
    target: primary || 'persona/keywords.yaml primary.keyword',
    fix: { action: 'Put the primary keyword in the headline. It is the only field that reliably appears in LinkedIn search.', effort: 'trivial' },
    replacement: primary ? `... ${primary} ...` : null,
  };
});

define('pc3', () => {
  const hasOutcome = /\b(for|that|so that|helps?|enables?|which)\b/i.test(headline);
  const hasProof = allNumbers.some((n) => headline.includes(n));
  return {
    pass: hasOutcome || hasProof,
    measured: hasOutcome ? 'outcome pattern present' : hasProof ? 'proof number present' : 'role only, no outcome',
    target: 'an outcome clause or a sourced number',
    fix: { action: 'Add what the outcome is, not just what the title is. "Automation Consultant" is a category; "cut onboarding from 14 days to 3" is a reason to reply.', effort: 'low' },
  };
});

define('pc4', () => {
  const firstPerson = /\b(I|my|me)\b/i.test(aboutPreview);
  const hasValue = has(pos.problem, aboutPreview) || has(pos.method, aboutPreview);
  return {
    pass: !firstPerson && hasValue,
    measured: `first-person in preview: ${firstPerson}; problem/method present: ${hasValue}`,
    target: 'value in the first 210 characters, no origin story',
    fix: { action: 'Move the "I started my career in..." paragraph below the fold. Only 210 characters show before the truncation link.', effort: 'low', source_template: 'templates/about.skeletons.md' },
  };
});

define('pc5', () => {
  const method = pos.method;
  const present = !!method && (has(method, headline) || has(method, aboutPreview));
  return {
    pass: present,
    measured: method ? (present ? `"${method}" present` : `"${method}" not in headline or preview`) : 'no named method in persona',
    target: 'a named method in headline or first 210 characters',
    fix: { action: 'Name the approach. A nameless method cannot be referred to, quoted, or searched for.', effort: 'medium' },
  };
});

define('pc6', () => {
  const d = pos.differentiator;
  return {
    pass: !!d && has(d, about),
    measured: d ? (has(d, about) ? 'present' : 'not stated in About') : 'not defined in persona',
    target: 'the differentiator stated in About',
    fix: { action: 'Add one sentence on why this over the obvious alternative. "Ten years in" and "I do it cheaper" are not differentiators; a specific position is.', effort: 'low' },
  };
});

define('ps1', () => {
  const distinct = new Set(
    allNumbers
      .map((n) => n.trim())
      .filter((n) => !/^(?:[0-9]{4})$/.test(n)),
  );
  const inExp = experience.flatMap((e) => e.bullets ?? []).join(' ');
  const count = distinct.size;
  return {
    pass: count >= 3,
    measured: `${count} distinct numeric outcomes in profile copy`,
    target: '>=3',
    fix: { action: 'Add numbers to three places: one in About, one in the current role, one in Featured. Unnumbered claims read as unverified.', effort: 'medium' },
  };
});

define('ps2', () => {
  const top3 = experience.slice(0, 3);
  if (!top3.length) return { pass: false, measured: 'no experience entries', target: '60% of bullets containing a digit', fix: { action: 'Add experience entries.', effort: 'high' } };
  const perRole = top3.map((e) => {
    const bullets = e.bullets ?? [];
    const withNum = bullets.filter((b) => /\d/.test(b)).length;
    return { role: e.company ?? e.title, total: bullets.length, withNum, ratio: bullets.length ? withNum / bullets.length : 0 };
  });
  const ok = perRole.every((r) => r.ratio >= 0.6);
  return {
    pass: ok,
    measured: perRole.map((r) => `${r.role}: ${r.withNum}/${r.total}`).join('; '),
    target: '>=60% of bullets in each of the 3 most recent roles',
    fix: { action: 'Rewrite bullets as action + result + number. Templates in templates/experience.bullets.md.', effort: 'medium', source_template: 'templates/experience.bullets.md' },
  };
});

define('ps3', () => {
  const hit = featured.find((f) => (f.kind ?? '').toLowerCase().includes('case') || /case study/i.test(f.title ?? ''));
  return {
    pass: !!hit,
    measured: hit ? `"${hit.title}"` : `none of ${featured.length} featured entries is a case study`,
    target: '>=1 case study in Featured',
    fix: { action: 'One Featured slot goes to a written case study: situation, what was done, measured result. This is the highest-value asset on the whole profile.', effort: 'high' },
  };
});

define('ps4', () => {
  const usedIds = (persona.proof?.entries ?? []).filter((e) => e.claim && e.tier);
  const bad = usedIds.filter((e) => !e.source || (persona.proof?.policy?.require_client_permission && e.permission === 'requested'));
  return {
    pass: bad.length === 0 && usedIds.length > 0,
    measured: bad.length
      ? `${bad.length} entries missing a source or permission: ${bad.map((e) => e.id).join(', ')}`
      : `${usedIds.length} entries, all sourced`,
    target: 'every used proof entry has tier and source',
    fix: { action: 'Fill proof.yaml before using any of these claims. An unsourced number is worse than no number.', effort: 'low' },
  };
});

define('sc1', () => {
  const primary = kw.primary?.keyword;
  return results.pc2.pass
    ? { pass: true, measured: 'see pc2', target: 'see pc2', fix: { action: 'none', effort: 'trivial' } }
    : { pass: false, measured: 'absent', target: primary, fix: results.pc2.fix, replacement: results.pc2.replacement };
});

define('sc2', () => {
  const secondaries = (kw.secondary ?? []).map((s) => s.keyword).filter(Boolean);
  const hit = secondaries.find((k) => has(k, aboutPreview));
  return {
    pass: !!hit,
    measured: hit ? `"${hit}" found` : secondaries.length ? `none of: ${secondaries.join(', ')}` : 'no secondary keywords set',
    target: '>=1 secondary keyword in the About preview',
    fix: { action: 'Work one secondary keyword into the first 210 characters. This is the only About text most people will read.', effort: 'low' },
  };
});

define('sc3', () => {
  const pinned = skills.slice(0, 3).map((s) => (typeof s === 'string' ? s : s.name));
  const primary = kw.primary?.keyword;
  const hit = pinned.find((p) => primary && has(primary, p));
  return {
    pass: !!hit,
    measured: pinned.length ? `pinned: ${pinned.join(', ')}` : 'no pinned skills',
    target: `primary keyword or variant among the 3 pinned`,
    fix: { action: 'Pin the three skills a buyer would search for. The pinned three are what LinkedIn displays.', effort: 'trivial', source_template: 'templates/skill-stack.md' },
  };
});

define('sc4', () => {
  const slug = idProfile.custom_url_slug ?? profile.custom_url_slug ?? '';
  const isDefault = !slug || /^\d+$/.test(slug) || /^\d{5,}$/.test(profile.publicIdentifier ?? '');
  return {
    pass: !isDefault,
    measured: slug ? `"${slug}"` : 'no custom slug',
    target: 'a readable custom URL',
    fix: { action: 'Claim a custom URL: name + domain. It survives platform changes and is usable in an email signature.', effort: 'trivial' },
  };
});

define('cm1', () => ({ pass: !!idProfile.banner_image, measured: idProfile.banner_image ? 'set' : 'not set', target: 'a banner image', fix: { action: 'Banner carries one message plus contact detail. Brief in templates/banner-brief.md.', effort: 'medium', source_template: 'templates/banner-brief.md', needs_human: true } }));
define('cm2', () => ({ pass: !!idProfile.profile_photo, measured: idProfile.profile_photo ? 'set' : 'not set', target: 'a positioning photo', fix: { action: 'Plain background, visible from a thumbnail, no group photos. A human judges this one.', effort: 'low', needs_human: true } }));
define('cm3', () => ({ pass: about.length >= 500, measured: `${about.length} characters`, target: '>=500', fix: { action: 'Write the About section. This is the longest text surface you own and the one most often left empty.', effort: 'medium', source_template: 'templates/about.skeletons.md' } }));
define('cm4', () => ({ pass: experience.length >= 3, measured: `${experience.length} entries`, target: '>=3', fix: { action: 'Add at least three roles. Three roles let a reader see a trajectory instead of a job.', effort: 'medium' } }));
define('cm5', () => ({ pass: education.length + licenses.length >= 1, measured: `${education.length} education, ${licenses.length} licenses`, target: '>=1', fix: { action: 'Add education or a certification. For a professional audience it is a cheap credibility transfer.', effort: 'low' } }));
define('cm6', () => ({ pass: featured.length >= 5, measured: `${featured.length} entries`, target: '>=5 slots filled', fix: { action: 'Fill all five Featured slots. Empty slots are worse than unused ones because they are visibly empty.', effort: 'medium', source_template: 'templates/featured.md' } }));
define('cm7', () => ({ pass: Object.values(contacts).some(Boolean), measured: Object.entries(contacts).filter(([, v]) => v).map(([k]) => k).join(', ') || 'no contact method', target: 'at least one contact method', fix: { action: 'Add a contact method. If the offer exists but the way to start it does not, inbound goes nowhere.', effort: 'trivial' } }));

define('rb1', () => ({ pass: headline.length > 0 && headline.length <= 220, measured: `${headline.length} characters`, target: '<=220 (LinkedIn hard limit)', fix: { action: 'LinkedIn truncates at 220. Count before publishing, not after.', effort: 'trivial' } }));
define('rb2', () => {
  const ok = about.length > 0 && about.length <= 2600;
  const endsClean = /[.!?…]\s*$/.test(aboutPreview) || /[,;:—-]\s*$/.test(aboutPreview);
  return {
    pass: ok && endsClean,
    measured: `${about.length} characters; preview ${endsClean ? 'ends cleanly' : 'ends mid-clause'}`,
    target: '<=2600 and preview ends on a boundary',
    fix: { action: ok ? 'The truncation point lands mid-sentence, which reads as careless. Reword so character 210 is a break.' : `About is ${about.length > 2600 ? 'over' : 'under'} the limit.`, effort: 'low' },
  };
});
define('rb3', () => ({ pass: longestParagraphChars(about) <= 180, measured: `${longestParagraphChars(about)} chars in longest About paragraph`, target: '<=180', fix: { action: 'Break the paragraph. LinkedIn mobile collapses it.', effort: 'trivial' } }));
define('rb4', () => ({ pass: mean(sentenceLengths(about)) <= (persona.voice?.sentence?.target_words ?? 14) + 6, measured: `${round(mean(sentenceLengths(about)), 1)} words`, target: `<=${(persona.voice?.sentence?.target_words ?? 14) + 6}`, fix: { action: 'Shorten the longest sentences in About.', effort: 'low' } }));

define('cv1', () => {
  const forbid = offers.cta_policy?.forbid ?? [];
  const candidates = [
    /\b(?:comment|DM|dm me|message me|reply|email me|send me|reach out|book|call me|grab)\b/i,
    /\b(?:link|url) (?:is )?(?:in|below)\b/i,
    /https?:\/\/\S+/,
    /\bread more\b/i,
  ];
  const found = candidates.find((re) => re.test(about));
  const forbidden = forbid.find((f) => new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(about));
  return {
    pass: !!found && !forbidden,
    measured: forbidden ? `forbidden phrase "${forbidden}"` : found ? 'CTA present' : 'no CTA in About',
    target: 'one specific CTA, not a forbidden engagement phrase',
    fix: {
      action: forbidden
        ? `Replace "${forbidden}". Generic engagement asks get the lowest-effort response of all.`
        : 'End About with one specific next step and where it goes.',
      effort: 'low',
      source_template: 'persona/offers.yaml ladder cta_text',
    },
  };
});

define('cv2', () => {
  const ok = (offers.paid_offers ?? []).some((o) => o.name && o.outcome && o.price_model);
  return {
    pass: ok,
    measured: ok ? `${offers.paid_offers.length} complete offer(s)` : 'no offer with name + outcome + price model',
    target: '>=1 complete offer in persona/offers.yaml',
    fix: { action: 'Define the offer before optimising anything else. A profile that generates attention and converts none of it is a vanity project.', effort: 'medium' },
  };
});

define('cv3', () => {
  const offerAssetIds = new Set((offers.paid_offers ?? []).filter((o) => o.featured_slot).map((o) => o.name));
  const hit = featured.find((f) => offerAssetIds.has(f.title));
  return {
    pass: !!hit,
    measured: hit ? `"${hit.title}"` : `${featured.length} featured entries, none pointing at the offer`,
    target: '>=1 Featured entry for the offer',
    fix: { action: 'One slot is a landing point for the offer itself. A reader should be able to act on interest without hunting for a contact.', effort: 'medium' },
  };
});

define('cv4', () => {
  const dest = (offers.ladder ?? []).map((r) => r.cta_destination).filter(Boolean);
  const bad = dest.find((d) => /^(TODO|TBD|xxx|example)/i.test(d) || d.trim() === '');
  const hasReal = dest.some((d) => /^(https?:\/\/|comment$|dm$)/i.test(d));
  return {
    pass: !bad && hasReal,
    measured: bad ? `placeholder destination "${bad}"` : hasReal ? `${dest.length} destinations, at least one real` : 'no usable destination',
    target: 'a url, "comment", or "dm"',
    fix: { action: 'Fill the CTA destination. A CTA pointing nowhere is a dead end the reader pays for in trust.', effort: 'trivial' },
  };
});

define('pcx1', () => {
  const avoid = persona.voice?.vocabulary?.avoid ?? [];
  const banned = avoid.filter((w) => visibleText.toLowerCase().includes(String(w).toLowerCase()));
  return {
    pass: banned.length === 0,
    measured: banned.length ? banned.join(', ') : 'none',
    target: '0 occurrences of persona voice avoid-list',
    fix: { action: 'Replace the banned word with the specific thing. "leverage" is "use"; "seamless" is the actual friction you removed.', effort: 'low' },
  };
});

define('pcx2', () => {
  const hits = (persona.povMap?.pillars ?? []).filter((p) => {
    const terms = String(p.promise ?? '').toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    return terms.some((t) => visibleText.toLowerCase().includes(t));
  });
  return {
    pass: hits.length >= 2,
    measured: `${hits.length} of ${(persona.povMap?.pillars ?? []).length} pillars visible: ${hits.map((p) => p.id).join(', ') || 'none'}`,
    target: '>=2',
    fix: { action: 'The profile should preview what the feed delivers. Bring at least two pillar themes into About or Experience.', effort: 'medium' },
  };
});

define('pcx3', () => {
  const samples = persona.voiceSamples ?? [];
  if (!samples.length) {
    return {
      pass: false,
      measured: 'no voice-samples.md entries to compare against',
      target: 'similarity >= 0.6',
      fix: {
        action: 'Add 3 posts to persona/voice-samples.md so tone can be measured instead of guessed.',
        effort: 'medium',
      },
    };
  }
  const agg = aggregateProfiles(samples.map((s) => styleProfile(s)));
  const here = styleProfile(visibleText);
  const sim = styleSimilarity(here, agg);
  return {
    pass: sim >= 0.6,
    measured: round(sim, 3),
    target: '>=0.6 similarity to voice-samples.md',
    fix: {
      action: 'Match the rhythm of the sample posts: sentence length variance, pronoun mix, punctuation density.',
      effort: 'medium',
    },
  };
});

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------
const findings = [];
let earned = 0;
let possible = 0;
const dimensionMeasurements = {};

for (const dim of pr.dimensions) {
  let dEarned = 0;
  dimensionMeasurements[dim.id] = {};
  for (const check of dim.checks) {
    const r = results[check.id] ?? { pass: false, measured: 'not implemented', target: null, fix: { action: 'Implement this check.', effort: 'low' } };
    possible += check.points;
    if (r.pass) {
      dEarned += check.points;
      earned += check.points;
    }
    dimensionMeasurements[dim.id][check.id] = r.measured;
    findings.push({
      check_id: check.id,
      dimension: dim.id,
      severity: check.severity ?? 'warn',
      hard_block: false,
      passed: !!r.pass,
      label: check.label,
      points_at_stake: check.points,
      measured: r.measured ?? null,
      target: r.target ?? null,
      offending: r.pass ? null : r.replacement ? null : null,
      fix: r.fix ?? { action: 'No fix defined.', effort: 'low' },
      replacement: r.replacement ?? null,
    });
  }
}

const band = bandFor(earned, pr.bands);
let total = earned;
let capped = false;
let capReason = null;
const blockers = findings.filter((f) => !f.passed && f.severity === 'blocker').map((f) => f.check_id);
if (blockers.length) {
  total = Math.min(total, 59);
  capped = true;
  capReason = `blocking checks failed: ${blockers.join(', ')}. Total capped at 59 regardless of other points.`;
}

const report = {
  schema_version: 1,
  kind: 'profile',
  subject: profile.custom_url_slug ?? profile.name ?? 'unknown',
  generated_at: nowISO(),
  persona_version: persona.identity?.persona?.version ?? '0.0.0',
  total,
  total_possible: 100,
  raw_points: earned,
  band,
  capped,
  cap_reason: capReason,
  dimensions: pr.dimensions.map((dim) => {
    const dimFindings = findings.filter((f) => f.dimension === dim.id);
    const e = dimFindings.filter((f) => f.passed).reduce((a, f) => a + f.points_at_stake, 0);
    const p = dimFindings.reduce((a, f) => a + f.points_at_stake, 0);
    return {
      id: dim.id,
      label: dim.label,
      question: dim.question,
      points_earned: e,
      points_possible: p,
      ratio: p ? round(e / p, 3) : 0,
      computed: true,
      measurements: dimensionMeasurements[dim.id],
    };
  }),
  findings: orderFindings(findings),
  next_actions: orderFindings(findings)
    .filter((f) => !f.passed)
    .slice(0, 6)
    .map((f) => ({ check_id: f.check_id, action: f.fix.action, severity: f.severity, points_at_stake: f.points_at_stake })),
  stop_conditions: blockers.length
    ? [{ id: 'sc_stop_1', when: 'profile-rubric score < 40 or a blocker failed', why: 'Writing content for an unclear profile amplifies the wrong message.', action: 'run playbooks/01-build-from-zero.md before generating any content' }]
    : [],
  not_scored: [
    'Photo quality and expression',
    'Banner aesthetics and legibility',
    'Whether the headline is actually persuasive (it is only keyword- and outcome-checked)',
    'Tone quality beyond measurable style markers',
    'Whether Featured assets are good, only that slots are filled',
    'Anything about reach or engagement. Lina cannot know that without analytics.',
  ],
};

if (args.flags.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderReport(report));
  const meaning = (pr.bands ?? []).find((b) => b.label === band)?.meaning;
  if (meaning) console.log(`\n"${band}": ${meaning}`);
}

if (args.flags.out) writeJson(args.flags.out, report);

const min = Number(args.flags.min ?? 60);
process.exit(total < min ? 1 : 0);