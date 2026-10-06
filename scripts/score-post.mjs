#!/usr/bin/env node
// Score a LinkedIn post against rubric/post-rubric.yaml.
//
//   node scripts/score-post.mjs output/drafts/post-2026-01-08.json
//   node scripts/score-post.mjs --file output/drafts/post.json --json
//   node scripts/score-post.mjs --text "hook line
//   body" --history output/published.jsonl
//
// Reads either a post.schema.json file or raw --text. Writes the score back
// into the post when given --write.
// Exit 0 = above threshold, 1 = below, 3 = cannot run.

import { parseArgs, renderReport, usage, bandFor, orderFindings, truncate } from './lib/cli.mjs';
import { loadPersona, loadRubric } from './lib/persona.mjs';
import { readJson, repoPath, writeJson, nowISO, fileExists, readText } from './lib/fsio.mjs';
import {
  styleProfile,
  ngrams,
  ngramOverlap,
  mean,
  secondToFirstRatio,
  emojiCount,
  hashtagCount,
  charCount,
  wordCount,
  sentenceLengths,
  lengthVariance,
  longestParagraphChars,
  imperativeSentences,
  firstLine,
  numbers,
  round,
} from './lib/textstats.mjs';
import { findHardBans, findSoftTells, countOccurrences } from './lib/slop.mjs';
import { checkVoice } from './check-voice.mjs';

const args = parseArgs();
if (args.flags.help) {
  console.log(usage([
    'score-post — score a LinkedIn post against the post rubric',
    '',
    '  --file PATH     post.schema.json file',
    '  --text STR      raw post text',
    '  --history PATH  jsonl of previously published posts, for repetition',
    '  --json          machine-readable',
    '  --write         write score and status back into the post file',
  ]));
  process.exit(0);
}

const persona = loadPersona();
const rubric = loadRubric();
const postRubric = rubric.post;
if (!postRubric) {
  console.error('rubric/post-rubric.yaml not found');
  process.exit(3);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
let post = null;
let text = null;
const file = args.flags.file ?? args._[0];
if (file) {
  if (!fileExists(file)) {
    console.error(`file not found: ${file}`);
    process.exit(3);
  }
  post = readJson(file);
  text = post.text;
} else if (args.flags.text) {
  text = args.flags.text;
} else {
  console.error('need --file PATH or --text STR');
  process.exit(2);
}

if (!text || !text.trim()) {
  console.error('post has no text');
  process.exit(2);
}

const profile = styleProfile(text);
const voiceCfg = persona.voice ?? {};
const fmtCfg = voiceCfg.formatting ?? {};
const sentCfg = voiceCfg.sentence ?? {};
const paraCfg = voiceCfg.paragraph ?? {};

// ---------------------------------------------------------------------------
// Repetition against previously published posts
// ---------------------------------------------------------------------------
let history = [];
if (args.flags.history) {
  const raw = readText(args.flags.history);
  history = raw
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((p) => (typeof p === 'string' ? p : p.text))
    .filter(Boolean);
}
const thisGrams = ngrams(text, 4);
const overlaps = history.map((h) => ({
  preview: h.slice(0, 60).replace(/\s+/g, ' '),
  overlap: round(ngramOverlap(thisGrams, ngrams(h, 4), 4), 3),
}));
const worstOverlap = overlaps.reduce((max, o) => Math.max(max, o.overlap), 0);

// ---------------------------------------------------------------------------
// Voice and proof checks. Reused from check-voice.mjs so the two can never
// disagree about what a post contains.
// ---------------------------------------------------------------------------
const voiceReport = checkVoice({ text, persona, includeFindings: true });
const hardBans = voiceReport.hard_bans;
const softTells = voiceReport.soft_tells;
const needsSource = voiceReport.needs_source ?? [];

// ---------------------------------------------------------------------------
// Hook pattern detection. Families mirror content/hooks.md.
// ---------------------------------------------------------------------------
const HOOK_FAMILIES = {
  'cost-first': [/cost you|you pay for|costs? (?:you|them)|burning|wasting|revenue (?:you|we) lose|lost (?:revenue|money|time)/i],
  'wrong-belief': [/most (?:people|companies|teams) (?:think|believe|assume)|everyone (?:thinks|believes)|is wrong|not actually|myth/i],
  'observation': [/I(?:'ve| have)? (?:noticed|seen|watched)|over the last \d+|these past \d+|since \d{4}/i],
  'number-list': [/^\s*\d+|[one two three four five six seven eight nine ten]+\s+(?:ways|things|steps|reasons|rules|lessons|mistakes)/i],
  'direct-question': [/\?\s*$/, /^(?:why|what|how|when|which|who|where|do|does|did|is|are|should|would|could|can)\b/i],
  'contrast': [/but|however|except|instead|yet the|despite/],
  'story-open': [/^last (?:week|month|year|night)|when I|back in \d{4}|the day I|first time I/i],
  'consequence': [/cost|consequence|ends? up|result is|what happens (?:when|if)|leads? to/i],
  'proof-first': [/\d+%|\b\d+x\b|\d+ (?:hours?|days?|weeks?|months?|clients?|customers?)/i],
  'demonstrable': [/here(?:'s| is) (?:how|the|a)|step \d|first, |copy this/i],
};

const line1 = firstLine(text);
const hookHead = `${line1} ${text.split('\n').slice(0, 2).join(' ')}`;
const matchedHookFamilies = Object.entries(HOOK_FAMILIES)
  .filter(([, patterns]) => patterns.some((re) => re.test(hookHead)))
  .map(([family]) => family);

// ---------------------------------------------------------------------------
// CTA detection
// ---------------------------------------------------------------------------
const CTA_MARKERS = [
  /\b(?:comment|DM|dm me|message me|reply|drop a|leave a|send me|email me|tell me|let me know)\b/i,
  /\b(?:link|URL|url) (?:is )?(?:in|below)\b/i,
  /\b(?:read|full (?:guide|breakdown|version)) (?:more )?(?:here|below|in the)\b/i,
  /\b(?:follow|connect with me|add me)\b/i,
  /\bsave this\b/i,
  /\b(?:sign up|get access|book|book a|call|grab)\b/i,
  /\?\s*$/m,
];
const ctaPositions = [];
CTA_MARKERS.forEach((re) => {
  const m = re.exec(text);
  if (m) ctaPositions.push(m.index / Math.max(text.length, 1));
});
const ctaCount = ctaPositions.length;
const ctaRatio = ctaPositions.length ? Math.min(...ctaPositions) : 1;

const forbiddenCta = (persona.offers?.cta_policy?.forbid ?? []).find((f) =>
  new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text),
);

// ---------------------------------------------------------------------------
// Measures
// ---------------------------------------------------------------------------
const len = sentenceLengths(text);
const measures = {
  chars: charCount(text),
  words: wordCount(text),
  lines: text.split('\n').length,
  firstLineChars: charCount(line1),
  firstLineWords: wordCount(line1),
  meanSentenceWords: round(mean(len), 2),
  lengthVariance: round(lengthVariance(len), 3),
  longestParagraphChars: longestParagraphChars(text),
  emoji: emojiCount(text),
  hashtags: hashtagCount(text),
  imperativeSentences: imperativeSentences(text).length,
  numbers: numbers(text).length,
  secondToFirstRatio: round(secondToFirstRatio(text), 2),
  worstRepetitionOverlap: round(worstOverlap, 3),
  ctaCount,
  ctaRatio: round(ctaRatio, 3),
  matchedHookFamilies,
  hardBans: hardBans.length,
  softTells: softTells.length,
  needsSource: needsSource.length,
};

const tv = persona.proof?.policy?.minimum_tier_for_strong_claim ?? 'observed';
const tierOk = needsSource.every((n) => ['verified', 'observed', 'anecdotal'].includes(n.tier) && (n.tier !== 'anecdotal' || tv === 'anecdotal'));

// ---------------------------------------------------------------------------
// Check implementations, keyed by check id from the rubric.
// ---------------------------------------------------------------------------
const CHECKS = {
  // hook ------------------------------------------------------------------
  h1: {
    pass: measures.firstLineChars <= 130 && measures.firstLineWords <= 18,
    measured: `${measures.firstLineChars} chars / ${measures.firstLineWords} words`,
    target: '<=130 chars and <=18 words',
    fix: {
      action: 'Tighten the first line. Delete the setup clause and start at the noun.',
      effort: 'trivial',
    },
  },
  h2: {
    pass: measures.matchedHookFamilies.length > 0,
    measured: measures.matchedHookFamilies.length ? measures.matchedHookFamilies.join(', ') : 'no pattern matched',
    target: 'a recognised hook family',
    fix: { action: 'Recast line 1 using one of the ten families in content/hooks.md.', effort: 'low' },
  },
  h3: { computed: false, pass: null, fix: { action: 'Judge: does line 1 name a concrete thing, or only an abstraction?', effort: 'low', needs_human: true } },
  h4: { computed: false, pass: null, fix: { action: 'Judge: is the post\'s actual claim stated before the midpoint?', effort: 'low', needs_human: true } },

  // specificity ----------------------------------------------------------
  s1: { computed: false, pass: null, fix: { action: 'Judge: could a reader picture the scene without inventing it?', effort: 'medium', needs_human: true } },
  s2: {
    pass: needsSource.length === 0,
    measured: needsSource.length ? needsSource.map((n) => `${n.value} -> "${n.matched_claim}"`).join('; ') : 'all numbers trace to proof.yaml',
    target: 'every number has a sourced proof entry',
    fix: { action: 'Add the result to persona/proof.yaml with a tier and a source, or remove the number.', effort: 'low' },
  },
  s3: { computed: false, pass: null, fix: { action: 'Judge: read the post and mark any sentence that would work unchanged in a different niche.', effort: 'medium', needs_human: true } },

  // structure ------------------------------------------------------------
  st1: {
    pass: measures.meanSentenceWords <= (sentCfg.target_words ?? 14) + 4,
    measured: `${measures.meanSentenceWords} words`,
    target: `<=${(sentCfg.target_words ?? 14) + 4} words`,
    fix: { action: 'Split the longest sentences. One idea per sentence.', effort: 'low' },
  },
  st2: {
    pass: measures.lengthVariance >= (sentCfg.min_length_variance ?? 0.35),
    measured: round(measures.lengthVariance, 3),
    target: `>=${sentCfg.min_length_variance ?? 0.35}`,
    fix: { action: 'Vary the rhythm: mix one long sentence with one very short one.', effort: 'low' },
  },
  st3: {
    pass: measures.longestParagraphChars <= 180,
    measured: `${measures.longestParagraphChars} chars in longest paragraph`,
    target: '<=180 chars (about 4 lines)',
    fix: { action: 'Break the paragraph. LinkedIn mobile collapses it.', effort: 'trivial' },
  },
  st4: { computed: false, pass: null, fix: { action: 'Judge: 900-2000 chars for a text post. Anything longer needs content/formats.md.', effort: 'low', needs_human: true } },

  // value density --------------------------------------------------------
  vd1: {
    pass: measures.imperativeSentences >= 1,
    measured: measures.imperativeSentences,
    target: '>=1',
    fix: { action: 'Add one sentence the reader can act on today, stated as an instruction.', effort: 'low' },
  },
  vd2: { computed: false, pass: null, fix: { action: 'Judge: is the practical content stated, or gestured at?', effort: 'medium', needs_human: true } },
  vd3: {
    pass: worstOverlap < 0.25,
    measured: worstOverlap ? `${worstOverlap} against "${overlaps.find((o) => o.overlap === worstOverlap).preview}..."` : 'no history to compare',
    target: '<0.25 4-gram overlap',
    fix: { action: 'Change the framing. Reposting a similar argument with new words is still repetition.', effort: 'medium' },
  },

  // voice match ----------------------------------------------------------
  vm1: {
    pass: hardBans.length === 0,
    measured: hardBans.length ? hardBans.map((b) => b.phrase).join(', ') : 'none',
    target: '0',
    fix: { action: 'Cut the banned phrase outright. There is no context that rescues them.', effort: 'trivial' },
    replacement: null,
  },
  vm2: {
    pass: measures.softTells <= 1,
    measured: measures.softTells,
    target: '<=1',
    fix: { action: 'Replace the tells with the specific fact they are standing in for.', effort: 'low' },
  },
  vm3: {
    pass: measures.secondToFirstRatio >= 1.2 && measures.secondToFirstRatio <= 6,
    measured: measures.secondToFirstRatio,
    target: '1.2 - 6.0 (second person to first person, per 100 words)',
    fix: { action: 'Either address the reader more directly, or drop the self-reference.', effort: 'low' },
  },
  vm4: {
    computed: false,
    pass: null,
    fix: { action: 'Judge against persona/voice-samples.md: would a reader recognise this account?', effort: 'low', needs_human: true },
  },

  // cta ------------------------------------------------------------------
  ct1: {
    pass: ctaCount === (persona.offers?.cta_policy?.max_ctas_per_post ?? 1),
    measured: ctaCount,
    target: persona.offers?.cta_policy?.max_ctas_per_post ?? 1,
    fix: { action: 'Keep exactly one ask. Several asks get the cheapest answer of all of them, which is none.', effort: 'low' },
  },
  ct2: {
    pass: ctaRatio > 0.6,
    measured: round(ctaRatio, 3),
    target: '>0.6 (after the value is delivered)',
    fix: { action: 'Move the CTA after the payoff, not before it.', effort: 'trivial' },
  },
  ct3: { computed: false, pass: null, fix: { action: 'Judge: is the ask something this specific audience would answer?', effort: 'low', needs_human: true } },

  // format fit -----------------------------------------------------------
  ff1: {
    pass: measures.hashtags >= (fmtCfg.min_hashtags ?? 3) && measures.hashtags <= (fmtCfg.max_hashtags ?? 5),
    measured: measures.hashtags,
    target: `${fmtCfg.min_hashtags ?? 3}-${fmtCfg.max_hashtags ?? 5}`,
    fix: { action: 'Use 3-5. Large hashtags reach nobody relevant and mark the post as generic.', effort: 'trivial' },
  },
  ff2: {
    pass: measures.emoji <= (fmtCfg.max_emoji_per_post ?? 0),
    measured: measures.emoji,
    target: `<=${fmtCfg.max_emoji_per_post ?? 0}`,
    fix: { action: 'Remove the emoji. voice.formatting.emoji is false for this persona.', effort: 'trivial' },
  },
  ff3: {
    pass: !/^#{1,6}\s|\|.*\||\*\*\w+\*\*/m.test(text),
    measured: /\*\*/.test(text) ? 'bold or heading markup present' : 'clean',
    target: 'plain text only',
    fix: { action: 'LinkedIn renders no markdown. Remove it.', effort: 'trivial' },
  },
};

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------
const findings = [];
const dimensions = [];
let earned = 0;
let possible = 0;

for (const dim of postRubric.dimensions) {
  let dEarned = 0;
  let dPossible = 0;
  for (const check of dim.checks) {
    const impl = CHECKS[check.id] ?? { computed: false, pass: null };
    const isComputed = impl.computed !== false;
    const passed = impl.pass;
    const rule = {
      check_id: check.id,
      dimension: dim.id,
      severity: check.severity ?? 'warn',
      hard_block: false,
      passed: isComputed ? passed === true : false,
      judged: !isComputed,
      label: check.label,
      points_at_stake: check.points,
      measured: impl.measured ?? null,
      target: impl.target ?? (check.condition ?? null),
      offending: null,
      fix: impl.fix ?? { action: 'No fix defined.', effort: 'low' },
    };
    if (isComputed) {
      dPossible += check.points;
      if (passed) dEarned += check.points;
    }
    // Judged checks contribute 0 until scored. Silent 0 for a "judged" check
    // would understate the ceiling, so the report states it explicitly.
    findings.push(rule);
  }
  // Judged dimension: its points are only reachable with a human decision.
  const judgedPoints = dim.checks.filter((c) => CHECKS[c.id]?.computed === false).reduce((a, c) => a + c.points, 0);
  const dCeiling = dPossible;
  earned += dEarned;
  possible += dCeiling;
  dimensions.push({
    id: dim.id,
    label: dim.label,
    question: dim.question,
    points_earned: round(dEarned, 2),
    points_possible: dCeiling,
    ratio: dCeiling ? round(dEarned / dCeiling, 3) : 0,
    computed: judgedPoints === 0,
    measurements: {},
    judged_points_pending: judgedPoints,
  });
}

// Scale computed-only score onto the full 100 for a comparable total, and also
// report the raw ratio. A reader needs both: 62/100 where 25 points are pending
// is very different from 62/100 complete.
const judgedPending = postRubric.dimensions.reduce(
  (acc, dim) => acc + dim.checks.filter((c) => CHECKS[c.id]?.computed === false).reduce((a, c) => a + c.points, 0),
  0,
);
const computedPossible = 100 - judgedPending;
const scaled = computedPossible > 0 ? round((earned / computedPossible) * 100, 1) : 0;

// ---------------------------------------------------------------------------
// Hard blocks
// ---------------------------------------------------------------------------
const hardBlocks = [];
if (needsSource.length > 0) {
  hardBlocks.push({
    id: 'hb1',
    label: 'Unsourced factual claim',
    detail: needsSource.map(
      (n) => `"${n.value}" — not in proof.yaml. In: "${truncate(n.matched_claim, 110)}"`,
    ),
    reason: 'Lina must not manufacture results.',
    action:
      'Add each result to persona/proof.yaml with a tier and a source, or remove the number from the post.',
    effort: 'low',
  });
}
if (persona.proof?.policy?.require_client_permission && needsSource.some((n) => n.permission === 'requested' || n.permission === 'denied')) {
  hardBlocks.push({
    id: 'hb2',
    label: 'Client named without permission',
    detail: needsSource
      .filter((n) => n.permission === 'requested' || n.permission === 'denied')
      .map((n) => `"${n.value}" — permission is "${n.permission}"`),
    reason: 'Breach of confidentiality.',
    action: 'Genericise the subject ("a 12-person finance team") or set permission: granted in proof.yaml.',
    effort: 'low',
  });
}
if (hardBans.some((b) => /as an ai|ai.generated|language model/i.test(b.phrase))) {
  hardBlocks.push({
    id: 'hb3',
    label: 'Banned self-reference',
    detail: hardBans.filter((b) => /as an ai|ai.generated|language model/i.test(b.phrase)).map((b) => b.phrase),
    reason: 'Signals machine authorship to a professional audience.',
    action: 'Cut the phrase. There is no context that rescues it.',
    effort: 'trivial',
  });
}
const publishMode = persona.identity?.publish?.mode ?? 'draft';
if (!['auto'].includes(publishMode) && post?.status === 'published') {
  hardBlocks.push({
    id: 'hb5',
    label: 'Published outside the approval gate',
    detail: `publish.mode is "${publishMode}" but status is "published"`,
    reason: 'identity.publish.approval_required was bypassed.',
  });
}
if (persona.identity?.publish?.approval_required !== false && post && ['queued', 'published'].includes(post.status)) {
  const approved = (post.approvals ?? []).some((a) => a.decision === 'approved' || a.decision === 'edited');
  if (!approved && !post.gate_bypassed) {
    hardBlocks.push({
      id: 'hb6',
      label: 'No approval recorded',
      detail: `status is "${post.status}" with no approved entry in approvals`,
      reason: 'publish.approval_required is true.',
    });
  }
}

const total = hardBlocks.length ? 0 : scaled;
const band = hardBlocks.length ? 'reject' : bandFor(scaled, postRubric.grade_bands);

const report = {
  schema_version: 1,
  kind: 'post',
  subject: post?.id ?? (args.flags.text ? 'inline-text' : 'unknown'),
  generated_at: nowISO(),
  persona_version: persona.identity?.persona?.version ?? '0.0.0',
  total,
  total_possible: 100,
  band,
  computed_score: scaled,
  computed_points_earned: round(earned, 2),
  computed_points_possible: computedPossible,
  judged_points_pending: judgedPending,
  measures,
  dimensions,
  findings: orderFindings(findings),
  hard_blocks: hardBlocks,
  next_actions: orderFindings(findings)
    .filter((f) => !f.passed && !f.judged)
    .slice(0, 6)
    .map((f) => ({ check_id: f.check_id, action: f.fix.action, severity: f.severity, points_at_stake: f.points_at_stake })),
  stop_conditions: hardBlocks.length
    ? [{ id: 'sc_stop_5', when: 'hard_blocks > 0 in a queued draft', why: 'Non-negotiable.', action: 'block and require human edit' }]
    : [],
  not_scored: [
    'Whether line 1 is specific rather than generic (h3)',
    'Whether the claim appears before the midpoint (h4)',
    'Whether the post contains a concrete artefact (s1)',
    'Whether any sentence would work unchanged in another niche (s3)',
    'Whether length fits the format (st4)',
    'Whether the reader could act without rereading (vd2)',
    'Whether it sounds like persona/voice-samples.md (vm4)',
    'Whether the ask is one this audience would answer (ct3)',
  ],
};

if (args.flags.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderReport({ ...report, total_possible: 100 }));
  console.log('');
  console.log(`computed ${Math.round((earned / Math.max(computedPossible, 1)) * 100)}% of ${computedPossible} points`);
  console.log(`${judgedPending} points pending human judgement (listed under NOT SCORED)`);
  if (forbiddenCta) console.log(`forbidden CTA phrase present: "${forbiddenCta}"`);
}

if (args.flags.write && post && file) {
  post.score = {
    total,
    band,
    computed_score: scaled,
    judged_points_pending: judgedPending,
    dimensions: Object.fromEntries(dimensions.map((d) => [d.id, { points_earned: d.points_earned, points_possible: d.points_possible, ratio: d.ratio }])),
    hard_blocks: hardBlocks,
  };
  post.status = hardBlocks.length ? 'rejected' : total >= (persona.identity?.publish?.min_post_score ?? 75) ? 'in_review' : 'draft';
  post.updated_at = nowISO();
  writeJson(file, post);
  console.error(`\nwrote score and status ("${post.status}") back to ${file}`);
}

const threshold = persona.identity?.publish?.min_post_score ?? 75;
process.exit(hardBlocks.length || scaled < threshold ? 1 : 0);